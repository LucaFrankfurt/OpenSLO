
// Simplified OpenSLO Types for the Editor State

export type DocumentKind = 'SLO' | 'SLI';
export type IndicatorMode = 'inline' | 'reference';

export enum BudgetingMethod {
  Occurrences = 'occurrences',
  Timeslices = 'timeslices',
}

export enum TimeWindowUnit {
  Day = 'd',
  Hour = 'h',
  Minute = 'm',
  Week = 'w',
}

export interface MetricSource {
  type: string; // e.g., 'prometheus', 'datadog', 'cloudwatch'
  query: string;
}

export interface RatioMetric {
  good?: MetricSource;
  bad?: MetricSource;
  total: MetricSource;
}

export interface ThresholdMetric {
  source: MetricSource;
  operator: 'lt' | 'lte' | 'gt' | 'gte';
  value: number;
}

export interface SloState {
  id: string; // Unique identifier for local storage
  apiVersion: string;
  kind: DocumentKind;
  name: string;
  displayName: string;
  description: string;
  service: string;
  app: string; // metadata.labels.app
  
  // SLO Specific
  budgetingMethod: BudgetingMethod;
  target: number; // 0.0 to 1.0
  timeWindowCount: number;
  timeWindowUnit: TimeWindowUnit;
  timeWindowRolling: boolean;
  
  // Indicator Configuration
  indicatorMode: IndicatorMode; // UI state: 'inline' or 'reference'
  indicatorRef?: string;        // Used if mode is 'reference'

  // Metric Definition (Used if kind=SLI or (kind=SLO and mode=inline))
  indicatorType: 'ratio' | 'threshold';
  ratioMetric?: RatioMetric;
  thresholdMetric?: ThresholdMetric;
}

export const DEFAULT_SLO_STATE: SloState = {
  id: '',
  apiVersion: 'openslo/v1',
  kind: 'SLO',
  name: 'my-service-availability',
  displayName: 'My Service Availability',
  description: 'Availability SLO for the core API service',
  service: 'core-api',
  app: '',
  budgetingMethod: BudgetingMethod.Occurrences,
  target: 0.999,
  timeWindowCount: 28,
  timeWindowUnit: TimeWindowUnit.Day,
  timeWindowRolling: true,
  indicatorMode: 'inline',
  indicatorType: 'threshold',
  thresholdMetric: {
    source: {
      type: 'prometheus',
      query: 'http_request_duration_seconds_bucket{le="0.5"}'
    },
    operator: 'lte',
    value: 0.5
  }
};

export const TEMPLATES: Record<string, Partial<SloState>> = {
  availability: {
    kind: 'SLO',
    name: 'api-availability',
    displayName: 'API Availability',
    description: 'Percentage of successful requests',
    budgetingMethod: BudgetingMethod.Occurrences,
    target: 0.999,
    indicatorMode: 'inline',
    indicatorType: 'ratio',
    ratioMetric: {
      good: { type: 'prometheus', query: 'sum(rate(http_requests_total{status!~"5.."}[5m]))' },
      total: { type: 'prometheus', query: 'sum(rate(http_requests_total[5m]))' }
    }
  },
  latency: {
    kind: 'SLO',
    name: 'api-latency',
    displayName: 'API Latency',
    description: '99% of requests served within 200ms',
    budgetingMethod: BudgetingMethod.Occurrences,
    target: 0.99,
    indicatorMode: 'inline',
    indicatorType: 'threshold',
    thresholdMetric: {
      source: { type: 'prometheus', query: 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))' },
      operator: 'lte',
      value: 0.2
    }
  },
  sliReference: {
    kind: 'SLO',
    name: 'worker-latency-slo',
    displayName: 'Worker Latency',
    description: 'SLO referencing a shared SLI',
    target: 0.99,
    indicatorMode: 'reference',
    indicatorRef: 'worker-latency-sli'
  },
  standaloneSli: {
    kind: 'SLI',
    name: 'shared-error-sli',
    displayName: 'Shared Error SLI',
    description: 'Standard error rate SLI used by multiple services',
    indicatorType: 'ratio',
    ratioMetric: {
      bad: { type: 'prometheus', query: 'sum(rate(errors_total[5m]))' },
      total: { type: 'prometheus', query: 'sum(rate(requests_total[5m]))' }
    }
  }
};
