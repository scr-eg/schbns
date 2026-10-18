// worker/src/routes/search.ts
import { Hono } from "hono";
import { authMiddleware, permissionMiddleware } from "../middleware/auth";
import type { AppBindings } from "../index";

const search = new Hono<AppBindings>();
search.use("*", authMiddleware);

search.get("/", permissionMiddleware(["students.read", "students.crud", "teachers.read", "teachers.crud"]), async (c) => {
  const q = c.req.query("q");
  if (!q || q.length < 2) return c.json({ students: [], teachers: [], subjects: [], announcements: [] });

  const like = `%${q}%`;

  const [students, teachers, subjects, announcements] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, student_code, full_name FROM students WHERE deleted_at IS NULL AND (full_name LIKE ? OR student_code LIKE ?) LIMIT 5`
    ).bind(like, like).all(),
    c.env.DB.prepare(
      `SELECT id, full_name FROM teachers WHERE deleted_at IS NULL AND full_name LIKE ? LIMIT 5`
    ).bind(like).all(),
    c.env.DB.prepare(`SELECT id, name_ar FROM subjects WHERE name_ar LIKE ? LIMIT 5`).bind(like).all(),
    c.env.DB.prepare(
      `SELECT id, title FROM announcements WHERE status = 'published' AND title LIKE ? LIMIT 5`
    ).bind(like).all(),
  ]);

  return c.json({
    students: students.results,
    teachers: teachers.results,
    subjects: subjects.results,
    announcements: announcements.results,
  });
});

export default search;
