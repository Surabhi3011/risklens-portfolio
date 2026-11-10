// Tree-shaken ECharts: register only what the dashboard uses (bar charts on canvas).
import { BarChart } from 'echarts/charts';
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer]);

export { echarts };

export { CHART_TEXT } from './chartOptions';
