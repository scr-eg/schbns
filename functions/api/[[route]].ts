// Cloudflare Pages Function: يستقبل كل الطلبات على /api/* ويمررها لتطبيق Hono.
// يُنشر تلقائيًا مع الموقع (لا يوجد Worker منفصل).
import { handle } from "hono/cloudflare-pages";
import app from "../../server/src/index";

export const onRequest = handle(app);
