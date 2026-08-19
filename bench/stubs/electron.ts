export const app = {
  getPath: (_key: string): string => process.env.BENCH_USERDATA as string,
  getVersion: (): string => '1.7.0-bench',
}
