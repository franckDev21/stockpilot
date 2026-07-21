import type { IpcMain } from 'electron'
import { StatsService } from '../services/stats.service'

const service = new StatsService()

export function registerStatsHandlers(ipc: IpcMain): void {
  ipc.handle('stats:getDashboard',    ()        => service.getDashboard())
  ipc.handle('stats:getSalesPeriod',  (_e, data) => service.getSalesPeriod(data))
  ipc.handle('stats:getTopProducts',  (_e, data) => service.getTopProducts(data))
  ipc.handle('stats:getStockForecast',()        => service.getStockForecast())
  ipc.handle('stats:getReceivables',    ()        => service.getReceivables())
  ipc.handle('stats:getSalesTimeline',     (_e, days?: number) => service.getSalesTimeline(days))
  ipc.handle('stats:getSupplierPayables', ()                  => service.getSupplierPayables())
}
