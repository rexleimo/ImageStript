import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

class MetadataFinding {
  final String container;
  final String signal;
  final String detail;
  final String snippet;

  const MetadataFinding({
    required this.container,
    required this.signal,
    required this.detail,
    required this.snippet,
  });
}

class MetadataReport {
  final List<MetadataFinding> findings;

  const MetadataReport(this.findings);

  bool get hasAiMetadata => findings.isNotEmpty;

  String get summary {
    if (findings.isEmpty) return 'No AI metadata signatures found';
    final signals = findings.map((finding) => finding.signal).toSet();
    return signals.join(', ');
  }

  List<String> detailLines() => [
    for (final finding in findings)
      '${finding.container}: ${finding.signal} (${finding.detail}) - ${finding.snippet}',
  ];
}

class MetadataInspector {
  static const _pngMetadataChunks = {
    'tEXt',
    'zTXt',
    'iTXt',
    'eXIf',
    'iCCP',
    'caBX',
    'c2pa',
  };

  static const _webPMetadataChunks = {'EXIF', 'XMP ', 'ICCP', 'C2PA'};

  static final List<({RegExp pattern, String signal})> _aiSignals = [
    (
      pattern: RegExp(
        r'(stable[- ]?diffusion|sdxl|automatic1111|a1111|comfyui|invokeai|midjourney|dall[- .·]?e|firefly|aigc)',
        caseSensitive: false,
      ),
      signal: 'AI generator metadata',
    ),
    (
      pattern: RegExp(
        r'(negative prompt|cfg scale|sampler|model hash|checkpoint|lora|controlnet|workflow|steps:\s*\d+|seed:\s*\d+)',
        caseSensitive: false,
      ),
      signal: 'Stable Diffusion prompt/parameters',
    ),
    (
      pattern: RegExp(
        r'(c2pa|content credentials|jumbf|trainedalgorithmicmedia|digitalSourceType|ai[-.]?disclosure|softwareAgent)',
        caseSensitive: false,
      ),
      signal: 'C2PA/content provenance metadata',
    ),
    (
      pattern: RegExp(
        r'(xmpmeta|xmp:creatortool|dc:description|photoshop:instructions)',
        caseSensitive: false,
      ),
      signal: 'XMP creator/source metadata',
    ),
  ];

  static MetadataReport inspect(Uint8List bytes) {
    if (_isPng(bytes)) return MetadataReport(_inspectPng(bytes));
    if (_isJpeg(bytes)) return MetadataReport(_inspectJpeg(bytes));
    if (_isWebP(bytes)) return MetadataReport(_inspectWebP(bytes));
    return MetadataReport(_inspectReadableBytes('Binary scan', bytes));
  }

  static List<MetadataFinding> _inspectPng(Uint8List bytes) {
    final findings = <MetadataFinding>[];
    var offset = 8;

    while (offset + 12 <= bytes.length) {
      final length = _readUint32(bytes, offset);
      final dataStart = offset + 8;
      final dataEnd = dataStart + length;
      final next = dataEnd + 4;
      if (length < 0 || dataEnd > bytes.length || next > bytes.length) break;

      final type = latin1.decode(bytes.sublist(offset + 4, offset + 8));
      if (_pngMetadataChunks.contains(type)) {
        if (_isC2PAContainer(type)) {
          findings.add(_c2paContainerFinding('PNG $type'));
        }
        final data = bytes.sublist(dataStart, dataEnd);
        findings.addAll(
          _findSignals('PNG $type', _decodePngMetadata(type, data)),
        );
      }

      offset = next;
    }

    return findings;
  }

  static List<MetadataFinding> _inspectJpeg(Uint8List bytes) {
    final findings = <MetadataFinding>[];
    var offset = 2;

    while (offset + 4 <= bytes.length) {
      if (bytes[offset] != 0xff) {
        offset++;
        continue;
      }

      while (offset < bytes.length && bytes[offset] == 0xff) {
        offset++;
      }
      if (offset >= bytes.length) break;

      final marker = bytes[offset++];
      if (marker == 0xd9 || marker == 0xda) break;
      if (_isStandaloneJpegMarker(marker)) continue;
      if (offset + 2 > bytes.length) break;

      final length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;

      final payload = bytes.sublist(offset + 2, offset + length);
      if ((marker >= 0xe1 && marker <= 0xef) || marker == 0xfe) {
        final container =
            marker == 0xfe ? 'JPEG COM' : 'JPEG APP${marker - 0xe0}';
        findings.addAll(_findSignals(container, _decodeReadable(payload)));
      }
      offset += length;
    }

    return findings;
  }

  static List<MetadataFinding> _inspectWebP(Uint8List bytes) {
    final findings = <MetadataFinding>[];
    var offset = 12;

    while (offset + 8 <= bytes.length) {
      final chunkType = ascii.decode(
        bytes.sublist(offset, offset + 4),
        allowInvalid: true,
      );
      final size = _readUint32Le(bytes, offset + 4);
      final dataStart = offset + 8;
      final dataEnd = dataStart + size;
      if (size < 0 || dataEnd > bytes.length) break;

      if (_webPMetadataChunks.contains(chunkType)) {
        if (_isC2PAContainer(chunkType)) {
          findings.add(_c2paContainerFinding('WebP $chunkType'));
        }
        findings.addAll(
          _findSignals(
            'WebP $chunkType',
            _decodeReadable(bytes.sublist(dataStart, dataEnd)),
          ),
        );
      }

      offset = dataEnd + (size.isOdd ? 1 : 0);
    }

    return findings;
  }

  static bool _isC2PAContainer(String type) =>
      type == 'caBX' || type.toLowerCase() == 'c2pa';

  static MetadataFinding _c2paContainerFinding(String container) =>
      MetadataFinding(
        container: container,
        signal: 'C2PA/content provenance metadata',
        detail: 'C2PA container',
        snippet: 'C2PA container present',
      );

  static List<MetadataFinding> _inspectReadableBytes(
    String container,
    Uint8List bytes,
  ) => _findSignals(container, _decodeReadable(bytes));

  static List<MetadataFinding> _findSignals(String container, String text) {
    if (text.trim().isEmpty) return const [];

    final findings = <MetadataFinding>[];
    for (final aiSignal in _aiSignals) {
      final match = aiSignal.pattern.firstMatch(text);
      if (match == null) continue;
      findings.add(
        MetadataFinding(
          container: container,
          signal: aiSignal.signal,
          detail: match.group(0) ?? aiSignal.signal,
          snippet: _snippet(text, match.start),
        ),
      );
    }
    return findings;
  }

  static String _decodePngMetadata(String type, Uint8List data) {
    switch (type) {
      case 'tEXt':
        return _decodeReadable(data);
      case 'zTXt':
        final zero = data.indexOf(0);
        if (zero == -1 || zero + 2 >= data.length) return _decodeReadable(data);
        return '${latin1.decode(data.sublist(0, zero), allowInvalid: true)} ${_inflateReadable(data.sublist(zero + 2))}';
      case 'iTXt':
        return _decodeITXt(data);
      default:
        return _decodeReadable(data);
    }
  }

  static String _decodeITXt(Uint8List data) {
    final keywordEnd = data.indexOf(0);
    if (keywordEnd == -1 || keywordEnd + 2 >= data.length) {
      return _decodeReadable(data);
    }

    final keyword = utf8.decode(
      data.sublist(0, keywordEnd),
      allowMalformed: true,
    );
    final compressed = data[keywordEnd + 1] == 1;
    var offset = keywordEnd + 3;

    final languageEnd = _indexOfZero(data, offset);
    if (languageEnd == -1) return _decodeReadable(data);
    offset = languageEnd + 1;

    final translatedEnd = _indexOfZero(data, offset);
    if (translatedEnd == -1) return _decodeReadable(data);
    offset = translatedEnd + 1;

    final text = data.sublist(offset);
    return '$keyword ${compressed ? _inflateReadable(text) : utf8.decode(text, allowMalformed: true)}';
  }

  static String _inflateReadable(Uint8List bytes) {
    try {
      return utf8.decode(ZLibDecoder().convert(bytes), allowMalformed: true);
    } catch (_) {
      return _decodeReadable(bytes);
    }
  }

  static String _decodeReadable(Uint8List bytes) {
    final utf8Text = utf8.decode(bytes, allowMalformed: true);
    final latinText = latin1.decode(bytes, allowInvalid: true);
    return utf8Text.length >= latinText.length ? utf8Text : latinText;
  }

  static String _snippet(String text, int start) {
    final begin = (start - 40).clamp(0, text.length);
    final end = (start + 120).clamp(0, text.length);
    return text.substring(begin, end).replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  static bool _isPng(Uint8List bytes) =>
      bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4e &&
      bytes[3] == 0x47 &&
      bytes[4] == 0x0d &&
      bytes[5] == 0x0a &&
      bytes[6] == 0x1a &&
      bytes[7] == 0x0a;

  static bool _isJpeg(Uint8List bytes) =>
      bytes.length >= 2 && bytes[0] == 0xff && bytes[1] == 0xd8;

  static bool _isWebP(Uint8List bytes) =>
      bytes.length >= 12 &&
      ascii.decode(bytes.sublist(0, 4), allowInvalid: true) == 'RIFF' &&
      ascii.decode(bytes.sublist(8, 12), allowInvalid: true) == 'WEBP';

  static bool _isStandaloneJpegMarker(int marker) =>
      marker == 0x01 ||
      marker == 0xd0 ||
      marker == 0xd1 ||
      marker == 0xd2 ||
      marker == 0xd3 ||
      marker == 0xd4 ||
      marker == 0xd5 ||
      marker == 0xd6 ||
      marker == 0xd7;

  static int _indexOfZero(Uint8List bytes, int start) {
    for (var i = start; i < bytes.length; i++) {
      if (bytes[i] == 0) return i;
    }
    return -1;
  }

  static int _readUint32(Uint8List bytes, int offset) =>
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];

  static int _readUint32Le(Uint8List bytes, int offset) =>
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24);
}
