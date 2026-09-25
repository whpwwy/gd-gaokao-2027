// 选科要求服务（分包，院校详情页使用）
import subjectsData = require('../data/subjects.js');

export interface SubjectGroupView {
  /** 1 本科 / 2 专科 */
  level: number;
  category: string;
  /** 首选要求：1 仅物理 / 2 物理或历史均可 */
  first: number;
  /** 再选模式：0 不提要求 / 1 全部必选 */
  mode: number;
  subjects: string[];
  majors: string[];
}

const byCode = new Map<string, SubjectGroupView[]>();
subjectsData.schools.forEach((entry) => {
  const views: SubjectGroupView[] = entry.items.map((it) => ({
    level: it[0],
    category: it[1] >= 0 ? subjectsData.majors[it[1]] : '',
    first: it[2],
    mode: it[3],
    subjects: it[4].map((i) => subjectsData.subjects[i]),
    majors: it[5].map((i) => subjectsData.majors[i]),
  }));
  byCode.set(entry.c, views);
});

export const subjectService = {
  getSubjects(code: string): SubjectGroupView[] {
    return byCode.get(code) || [];
  },

  /**
   * 判断考生再选科目是否满足该专业类要求
   * @param view 专业类选科要求
   * @param userSubjects 考生再选科目名称集合
   */
  canApply(view: SubjectGroupView, userSubjects: string[]): boolean {
    if (view.mode === 0) return true;
    return view.subjects.every((s) => userSubjects.includes(s));
  },

  /** 再选要求的中文简述 */
  describe(view: SubjectGroupView): string {
    if (view.mode === 0 || view.subjects.length === 0) return '不提再选科目要求';
    return view.subjects.join('、') + ' 均须选考';
  },
};
