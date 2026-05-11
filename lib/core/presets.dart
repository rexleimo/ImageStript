enum Preset { subtle, standard, aggressive }

class StriptParams {
  final double noiseFraction;
  final int noiseStrength;
  final double resizeScale;
  final int jpegQuality;

  const StriptParams({
    this.noiseFraction = 0.03,
    this.noiseStrength = 1,
    this.resizeScale = 0.998,
    this.jpegQuality = 97,
  });

  static const presetParams = {
    Preset.subtle: StriptParams(
      noiseFraction: 0.01,
      noiseStrength: 1,
      resizeScale: 0.999,
      jpegQuality: 99,
    ),
    Preset.standard: StriptParams(
      noiseFraction: 0.03,
      noiseStrength: 1,
      resizeScale: 0.998,
      jpegQuality: 97,
    ),
    Preset.aggressive: StriptParams(
      noiseFraction: 0.06,
      noiseStrength: 2,
      resizeScale: 0.995,
      jpegQuality: 92,
    ),
  };

  StriptParams copyWith({
    double? noiseFraction,
    int? noiseStrength,
    double? resizeScale,
    int? jpegQuality,
  }) {
    return StriptParams(
      noiseFraction: noiseFraction ?? this.noiseFraction,
      noiseStrength: noiseStrength ?? this.noiseStrength,
      resizeScale: resizeScale ?? this.resizeScale,
      jpegQuality: jpegQuality ?? this.jpegQuality,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is StriptParams &&
      noiseFraction == other.noiseFraction &&
      noiseStrength == other.noiseStrength &&
      resizeScale == other.resizeScale &&
      jpegQuality == other.jpegQuality;

  @override
  int get hashCode => Object.hash(noiseFraction, noiseStrength, resizeScale, jpegQuality);
}
