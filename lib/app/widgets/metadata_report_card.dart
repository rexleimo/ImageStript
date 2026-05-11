import 'package:flutter/material.dart';
import 'package:stript/core/metadata_inspector.dart';

class MetadataReportCard extends StatelessWidget {
  final Map<String, MetadataReport> reports;

  const MetadataReportCard({super.key, required this.reports});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final findings =
        reports.entries.where((entry) => entry.value.hasAiMetadata).toList();

    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  findings.isEmpty
                      ? Icons.verified_user_outlined
                      : Icons.manage_search,
                  color:
                      findings.isEmpty
                          ? theme.colorScheme.primary
                          : theme.colorScheme.tertiary,
                ),
                const SizedBox(width: 8),
                Text('AI metadata scan', style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 8),
            if (findings.isEmpty)
              Text(
                'No embedded AI metadata signatures found.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              )
            else ...[
              Text(
                '${findings.length} file(s) contain removable AI/source metadata.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 8),
              for (final entry in findings.take(4))
                _FindingRow(fileName: entry.key, report: entry.value),
              if (findings.length > 4)
                Text(
                  '+${findings.length - 4} more file(s)',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FindingRow extends StatelessWidget {
  final String fileName;
  final MetadataReport report;

  const _FindingRow({required this.fileName, required this.report});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.warning_amber_rounded,
            size: 18,
            color: theme.colorScheme.tertiary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$fileName: ${report.summary}',
                  style: theme.textTheme.bodySmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                for (final finding in report.findings.take(2))
                  Text(
                    '${finding.container}: ${finding.detail} - ${finding.snippet}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
