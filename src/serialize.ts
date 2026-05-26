// Veritabanı kayıtlarını istemcinin (mobil/admin) beklediği biçime çevirir.

export function safeParse(s: string, fallback: unknown[] = []): any[] {
  try {
    return JSON.parse(s);
  } catch {
    return fallback as any[];
  }
}

/** Teacher: JSON `badges`/`availability` alanlarını diziye çevirir, `sessions` takma adı ekler. */
export function serializeTeacher(t: any) {
  return {
    ...t,
    badges: safeParse(t.badges),
    availability: safeParse(t.availability ?? '[]'),
    sessions: t.sessionsCount,
  };
}

/** Session: mobil uygulamanın beklediği `teacher` takma adını ekler. */
export function serializeSession(s: any) {
  return { ...s, teacher: s.teacherName };
}

/** SkillChain kaydını iç içe (ancestors/mentor/you/students/...) yapıya çevirir. */
export function serializeChain(c: any) {
  const nodes = [...(c.nodes ?? [])].sort(
    (a: any, b: any) => a.position - b.position,
  );
  const node = (n: any) => ({
    id: n.mockId ?? n.id,
    name: n.name,
    shortName: n.shortName,
    avatar: n.avatar,
    avatarColor: n.avatarColor,
    role: n.role,
    skill: n.skill,
    sessions: n.sessions,
    rating: n.rating,
    isOnline: n.isOnline,
    joinedDate: n.joinedDate ?? undefined,
  });

  const byRole = (r: string) => nodes.filter((n: any) => n.role === r);
  const ancestors = [...byRole("root"), ...byRole("grandmentor")];
  const mentor = nodes.find((n: any) => n.role === "mentor");
  const you = nodes.find((n: any) => n.role === "you");
  const students = byRole("student");
  const grandNodes = byRole("grandstudent");

  const grandStudents = students
    .map((s: any) => ({
      parentId: s.mockId ?? s.id,
      nodes: grandNodes
        .filter((g: any) => g.parentMockId === s.mockId)
        .map(node),
    }))
    .filter((g: any) => g.nodes.length > 0);

  return {
    id: c.id,
    skill: c.skill,
    category: c.category,
    color: c.color,
    gradient: safeParse(c.gradient, [c.color, c.color]),
    icon: c.icon,
    depth: c.depth,
    totalReach: c.totalReach,
    chain: {
      ancestors: ancestors.map(node),
      mentor: mentor ? node(mentor) : null,
      you: you ? node(you) : null,
      students: students.map(node),
      grandStudents,
    },
  };
}

/** Kullanıcı kaydından parola hash'ini çıkarır, JSON alanları diziye çevirir. */
export function publicUser(u: any) {
  const { passwordHash, ...rest } = u;
  void passwordHash;
  return {
    ...rest,
    skillsTeach: safeParse(rest.skillsTeach ?? '[]'),
    skillsLearn: safeParse(rest.skillsLearn ?? '[]'),
    savedTeachers: safeParse(rest.savedTeachers ?? '[]'),
  };
}
