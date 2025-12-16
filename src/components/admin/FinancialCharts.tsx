import { memo, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Lazy load recharts components
const LazyBarChart = lazy(() => import('recharts').then(mod => ({ default: mod.BarChart })));
const LazyBar = lazy(() => import('recharts').then(mod => ({ default: mod.Bar })));
const LazyXAxis = lazy(() => import('recharts').then(mod => ({ default: mod.XAxis })));
const LazyYAxis = lazy(() => import('recharts').then(mod => ({ default: mod.YAxis })));
const LazyCartesianGrid = lazy(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })));
const LazyTooltip = lazy(() => import('recharts').then(mod => ({ default: mod.Tooltip })));
const LazyResponsiveContainer = lazy(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })));
const LazyPieChart = lazy(() => import('recharts').then(mod => ({ default: mod.PieChart })));
const LazyPie = lazy(() => import('recharts').then(mod => ({ default: mod.Pie })));
const LazyCell = lazy(() => import('recharts').then(mod => ({ default: mod.Cell })));

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface FinancialChartsProps {
  monthlyData: any[];
  statusData: any[];
}

const ChartLoader = () => (
  <div className="flex items-center justify-center h-[300px]">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const FinancialCharts = memo(({ monthlyData, statusData }: FinancialChartsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الإيرادات الشهرية</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ChartLoader />}>
            <div className="h-[300px]">
              <LazyResponsiveContainer width="100%" height="100%">
                <LazyBarChart data={monthlyData}>
                  <LazyCartesianGrid strokeDasharray="3 3" />
                  <LazyXAxis dataKey="month" />
                  <LazyYAxis />
                  <LazyTooltip />
                  <LazyBar dataKey="revenue" fill="#10b981" name="الإيرادات" />
                  <LazyBar dataKey="profit" fill="#3b82f6" name="الأرباح" />
                </LazyBarChart>
              </LazyResponsiveContainer>
            </div>
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">توزيع الطلبات</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ChartLoader />}>
            <div className="h-[300px]">
              <LazyResponsiveContainer width="100%" height="100%">
                <LazyPieChart>
                  <LazyPie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((_, index) => (
                      <LazyCell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </LazyPie>
                  <LazyTooltip />
                </LazyPieChart>
              </LazyResponsiveContainer>
            </div>
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
});

FinancialCharts.displayName = 'FinancialCharts';

export default FinancialCharts;
