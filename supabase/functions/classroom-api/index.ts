import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://sprenk-bot.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "sb_publishable_61I9or8HLKyKkW2qYPWVCA_Akdu9774";
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function deriveTeacherHash(code: string, salt: string) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalizeCode(code)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: base64UrlToBytes(salt), iterations: 310000, hash: "SHA-256" }, keyMaterial, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}
function equalText(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}
function cleanRecord(record: Record<string, unknown>) {
  const { teacherCode: _secret, ...safe } = record;
  return safe;
}
function boundedJson(value: unknown) {
  const json = JSON.stringify(value);
  if (!json || json.length > 1_500_000) throw new Error("Class data is too large to sync in one update.");
  return JSON.parse(json) as Record<string, unknown>;
}
async function getClass(code: string) {
  const { data, error } = await db.from("flowlab_classrooms").select("id,class_code,teacher_salt,teacher_hash,class_payload,updated_at").eq("class_code", code).maybeSingle();
  if (error) throw error;
  return data;
}
async function getStudentWork(code: string) {
  const { data, error } = await db.from("flowlab_student_work").select("learner_id,work_payload").eq("class_code", code);
  if (error) throw error;
  return new Map((data ?? []).map((item: any) => [item.learner_id, item.work_payload ?? {}]));
}
function mergeStudentWork(student: Record<string, any>, work: Record<string, any> = {}) {
  return { ...student, ...work, id: student.id, name: student.name, marks: student.marks ?? {}, feedback: student.feedback ?? {} };
}
async function authenticateTeacher(row: any, teacherCode: string) {
  if (!row || normalizeCode(teacherCode).length < 8) return false;
  return equalText(await deriveTeacherHash(teacherCode, row.teacher_salt), row.teacher_hash);
}
async function signStudentSession(classCode: string, learnerId: string) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ classCode, learnerId, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(serviceKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `${payload}.${bytesToBase64Url(signature)}`;
}
async function verifyStudentSession(token: unknown, classCode: string) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 2) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(serviceKey), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(parts[1]), new TextEncoder().encode(parts[0]));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
    if (session.classCode !== classCode || !session.learnerId || Number(session.expiresAt) < Date.now()) return null;
    return session as { classCode: string; learnerId: string; expiresAt: number };
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return reply(405, { error: "Use POST for classroom actions." });
  if (!publicKey || request.headers.get("apikey") !== publicKey) return reply(401, { error: "This app is not configured for classroom access." });

  try {
    const body = await request.json();
    const action = String(body?.action ?? "");
    const code = normalizeCode(body?.classCode);
    if (code.length < 6 || code.length > 10) return reply(400, { error: "Enter a valid class code." });

    if (action === "teacher-save") {
      const teacherCode = normalizeCode(body?.teacherCode);
      const input = body?.classRecord;
      if (!input || typeof input !== "object" || normalizeCode(input.code) !== code || normalizeCode(input.teacherCode) !== teacherCode) return reply(400, { error: "Class details do not match the access codes." });
      const existing = await getClass(code);
      if (existing && !(await authenticateTeacher(existing, teacherCode))) return reply(403, { error: "The teacher recovery code did not match." });
      const saltBytes = existing ? base64UrlToBytes(existing.teacher_salt) : crypto.getRandomValues(new Uint8Array(16));
      const salt = existing ? existing.teacher_salt : bytesToBase64Url(saltBytes);
      const teacherHash = existing ? existing.teacher_hash : await deriveTeacherHash(teacherCode, salt);
      const payload = boundedJson(cleanRecord(input));
      const studentWork = await getStudentWork(code);
      if (Array.isArray(payload.students)) payload.students = payload.students.map((student: any) => mergeStudentWork(student, studentWork.get(student.id)));
      const update = {
        class_code: code,
        teacher_salt: salt,
        teacher_hash: teacherHash,
        class_payload: payload,
        updated_at: new Date().toISOString(),
      };
      const { error } = existing
        ? await db.from("flowlab_classrooms").update(update).eq("class_code", code)
        : await db.from("flowlab_classrooms").insert(update);
      if (error) throw error;
      return reply(200, { ok: true, updatedAt: new Date().toISOString() });
    }

    const row = await getClass(code);
    if (!row) return reply(404, { error: "No shared class uses that code." });
    const record = row.class_payload as Record<string, any>;

    if (action === "teacher-load") {
      if (!(await authenticateTeacher(row, body?.teacherCode))) return reply(403, { error: "The teacher recovery code did not match." });
      const studentWork = await getStudentWork(code);
      const learners = Array.isArray(record.students) ? record.students.map((student: any) => mergeStudentWork(student, studentWork.get(student.id))) : [];
      return reply(200, { classRecord: { ...record, students: learners, code, teacherCode: normalizeCode(body.teacherCode) }, updatedAt: row.updated_at });
    }

    const name = String(body?.studentName ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
    const roster = Array.isArray(record.students) ? record.students : [];
    const exactLearner = roster.find((student: any) => String(student?.name ?? "").trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    const firstNameMatches = roster.filter((student: any) => String(student?.name ?? "").trim().split(/\s+/)[0].toLocaleLowerCase() === name.toLocaleLowerCase());
    const learner = exactLearner ?? (firstNameMatches.length === 1 ? firstNameMatches[0] : null);
    if (!name || !learner) return reply(403, { error: "That name is not on this class roster. Check with your teacher." });

    if (action === "student-load") {
      if (record.classClosed) return reply(403, { error: "This class is closed. Ask your teacher for help." });
      if (!record.published) return reply(403, { error: "Your teacher has not published this lesson yet." });
      const studentWork = await getStudentWork(code);
      const publishedContent = record.publishedContent && typeof record.publishedContent === "object" ? record.publishedContent : record;
      return reply(200, { classRecord: { ...record, ...publishedContent, code, students: [mergeStudentWork(learner, studentWork.get(learner.id))] }, studentToken: await signStudentSession(code, learner.id), updatedAt: row.updated_at });
    }

    if (action === "student-save") {
      if (record.classClosed || !record.published) return reply(403, { error: "This class is not open for student work." });
      const studentSession = await verifyStudentSession(body?.studentToken, code);
      if (!studentSession) return reply(403, { error: "This student session has expired. Rejoin the class to continue." });
      const update = body?.learner;
      if (!update || typeof update !== "object") return reply(400, { error: "Learner update is missing." });
      const tokenLearner = record.students.find((student: any) => student.id === studentSession.learnerId);
      if (!tokenLearner || learner.id !== tokenLearner.id) return reply(403, { error: "This learner session does not match the roster entry." });
      const cleanLearner = boundedJson({
        id: learner.id,
        name: learner.name,
        initials: learner.initials,
        progress: String(update.progress ?? learner.progress).slice(0, 30),
        percent: Math.max(0, Math.min(100, Number(update.percent) || 0)),
        score: learner.score,
        answers: update.answers && typeof update.answers === "object" ? update.answers : learner.answers,
        submitted: Boolean(update.submitted),
        submittedAt: update.submitted && update.submittedAt ? String(update.submittedAt).slice(0, 40) : null,
        completedWorkflowSteps: Array.isArray(update.completedWorkflowSteps) ? update.completedWorkflowSteps.map(String) : learner.completedWorkflowSteps ?? [],
        completedMaterials: Array.isArray(update.completedMaterials) ? update.completedMaterials.slice(0, 40) : learner.completedMaterials,
        events: Array.isArray(update.events) ? update.events.slice(-600) : learner.events,
        marks: learner.marks ?? {},
        feedback: learner.feedback ?? {},
        lastSeen: new Date().toISOString(),
        activity: update.activity && typeof update.activity === "object" ? update.activity : learner.activity,
      });
      const workPayload = {
        progress: cleanLearner.progress,
        percent: cleanLearner.percent,
        answers: cleanLearner.answers,
        submitted: cleanLearner.submitted,
        submittedAt: cleanLearner.submittedAt,
        completedWorkflowSteps: cleanLearner.completedWorkflowSteps,
        completedMaterials: cleanLearner.completedMaterials,
        events: cleanLearner.events,
        lastSeen: cleanLearner.lastSeen,
        activity: cleanLearner.activity,
      };
      const { error } = await db.from("flowlab_student_work").upsert({ class_code: code, learner_id: tokenLearner.id, work_payload: workPayload, updated_at: new Date().toISOString() }, { onConflict: "class_code,learner_id" });
      if (error) throw error;
      return reply(200, { ok: true });
    }

    return reply(400, { error: "Unknown classroom action." });
  } catch (error) {
    console.error("FlowLab classroom API error", error);
    return reply(500, { error: error instanceof Error ? error.message : "Could not save classroom data." });
  }
});

