declare module "lunar-javascript" {
  export type LunarInstance = {
    getYearInGanZhi(): string;
    getYearInGanZhiExact(): string;
    getMonthInGanZhi(): string;
    getMonthInGanZhiExact(): string;
    getDayInGanZhi(): string;
    getDayInGanZhiExact(): string;
    getDayInGanZhiExact2(): string;
    getTimeInGanZhi(): string;
  };

  export type LunarStatic = {
    fromDate(date: Date): LunarInstance;
  };

  export const Lunar: LunarStatic;
}

