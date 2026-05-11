import 'package:flutter/material.dart';
import 'package:stript/core/presets.dart';

class ParameterSliders extends StatefulWidget {
  final StriptParams params;
  final ValueChanged<StriptParams> onChanged;

  const ParameterSliders({super.key, required this.params, required this.onChanged});

  @override
  State<ParameterSliders> createState() => _ParameterSlidersState();
}

class _ParameterSlidersState extends State<ParameterSliders> {
  bool _showAdvanced = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Preset', style: theme.textTheme.labelLarge),
            const SizedBox(width: 12),
            _presetChip(Preset.subtle, 'Subtle'),
            const SizedBox(width: 8),
            _presetChip(Preset.standard, 'Standard'),
            const SizedBox(width: 8),
            _presetChip(Preset.aggressive, 'Aggressive'),
          ],
        ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: () => setState(() => _showAdvanced = !_showAdvanced),
          icon: Icon(_showAdvanced ? Icons.expand_less : Icons.expand_more),
          label: Text(_showAdvanced ? 'Hide parameters' : 'Advanced parameters'),
        ),
        if (_showAdvanced) ...[
          const SizedBox(height: 8),
          _slider('Noise fraction', widget.params.noiseFraction, 0.0, 0.1,
              (v) => widget.onChanged(widget.params.copyWith(noiseFraction: v)), '${(widget.params.noiseFraction * 100).toStringAsFixed(1)}%'),
          _slider('Noise strength', widget.params.noiseStrength.toDouble(), 1, 5,
              (v) => widget.onChanged(widget.params.copyWith(noiseStrength: v.round())), '${widget.params.noiseStrength}'),
          _slider('Resize perturbation', widget.params.resizeScale, 0.9, 1.0,
              (v) => widget.onChanged(widget.params.copyWith(resizeScale: v)), widget.params.resizeScale.toStringAsFixed(3)),
          _slider('JPEG quality', widget.params.jpegQuality.toDouble(), 80, 100,
              (v) => widget.onChanged(widget.params.copyWith(jpegQuality: v.round())), '${widget.params.jpegQuality}'),
        ],
      ],
    );
  }

  Widget _presetChip(Preset preset, String label) {
    final isSelected = widget.params == StriptParams.presetParams[preset];
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => widget.onChanged(StriptParams.presetParams[preset]!),
    );
  }

  Widget _slider(String label, double value, double min, double max, ValueChanged<double> onChanged, String display) {
    return Row(
      children: [
        SizedBox(width: 140, child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
        Expanded(child: Slider(value: value, min: min, max: max, onChanged: onChanged)),
        SizedBox(width: 50, child: Text(display, style: Theme.of(context).textTheme.bodySmall)),
      ],
    );
  }
}
