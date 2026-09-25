// 数据说明页
import { dataService } from '../../services/data-service';

Page({
  data: {
    version: dataService.manifest.version,
    generatedAt: dataService.manifest.generatedAt.slice(0, 10),
    trackName: dataService.manifest.trackName,
    years: dataService.manifest.years,
    sources: dataService.manifest.sources,
    stats: dataService.manifest.stats,
  },
});
