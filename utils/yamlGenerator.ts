
import { SloState } from '../types';

export const generateYaml = (state: SloState): string => {
  const {
    apiVersion,
    kind,
    name,
    displayName,
    description,
    service,
    app,
    budgetingMethod,
    target,
    timeWindowCount,
    timeWindowUnit,
    timeWindowRolling,
    indicatorMode,
    indicatorRef,
    indicatorType,
    ratioMetric,
    thresholdMetric
  } = state;

  // 1. Build the Metric YAML block (reused by both SLO-Inline and SLI)
  let metricBlock = '';
  if (indicatorType === 'threshold' && thresholdMetric) {
    metricBlock = `thresholdMetric:
  metricSource:
    type: ${thresholdMetric.source.type}
    spec:
      query: >-
        ${thresholdMetric.source.query}
  operator: ${thresholdMetric.operator}
  value: ${thresholdMetric.value}`;
  } else if (indicatorType === 'ratio' && ratioMetric) {
    metricBlock = `ratioMetric:
  ${ratioMetric.good ? `good:
    metricSource:
      type: ${ratioMetric.good.type}
      spec:
        query: >-
          ${ratioMetric.good.query}` : ''}
  ${ratioMetric.bad ? `bad:
    metricSource:
      type: ${ratioMetric.bad.type}
      spec:
        query: >-
          ${ratioMetric.bad.query}` : ''}
  total:
    metricSource:
      type: ${ratioMetric.total.type}
      spec:
        query: >-
          ${ratioMetric.total.query}`;
  }

  // Remove empty lines created by conditionals in metricBlock
  metricBlock = metricBlock.replace(/^\s*\n/gm, '');

  // Prepare metadata labels
  let metadataLabels = '';
  if (app && app.trim()) {
    metadataLabels = `
  labels:
    app: ${app}`;
  }

  // 2. Generate based on Kind
  if (kind === 'SLI') {
    // Indent metric block for SLI spec
    const indentedMetric = metricBlock.split('\n').map(line => `  ${line}`).join('\n');
    
    return `apiVersion: ${apiVersion}
kind: SLI
metadata:
  name: ${name}
  displayName: ${displayName}${metadataLabels}
spec:
  description: ${description}
${indentedMetric}`;
  } 
  
  // kind === 'SLO'
  else {
    let indicatorSection = '';

    if (indicatorMode === 'reference' && indicatorRef) {
      indicatorSection = `  indicatorRef: ${indicatorRef}`;
    } else {
      // Inline indicator needs to be under `indicator:` key and indented
      const indentedMetric = metricBlock.split('\n').map(line => `    ${line}`).join('\n');
      indicatorSection = `  indicator:
${indentedMetric}`;
    }

    return `apiVersion: ${apiVersion}
kind: SLO
metadata:
  name: ${name}
  displayName: ${displayName}${metadataLabels}
spec:
  description: ${description}
  service: ${service}
  budgetingMethod: ${budgetingMethod}
  objectives:
    - displayName: ${displayName}
      target: ${target}
      timeWindow:
        - rolling: ${timeWindowRolling}
          count: ${timeWindowCount}
          unit: ${timeWindowUnit}
${indicatorSection}`;
  }
};
