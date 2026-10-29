import { supabase } from "@/integrations/supabase/client";

export const COURSE_BUCKET = "course-documents";
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  grade_level: string | null;
  content_language: string;
  status: "draft" | "published" | "archived";
  created_at: string;
};

export async function listMyCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, description, subject, grade_level, content_language, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CourseRow[];
}

export async function createCourse(input: {
  title: string;
  description?: string;
  subject?: string;
  grade_level?: string;
  content_language: string;
  teacher_id: string;
}) {
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title: input.title,
      description: input.description ?? null,
      subject: input.subject ?? null,
      grade_level: input.grade_level ?? null,
      content_language: input.content_language,
      teacher_id: input.teacher_id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function getCourse(courseId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setCourseStatus(courseId: string, status: "draft" | "published") {
  const { error } = await supabase.from("courses").update({ status }).eq("id", courseId);
  if (error) throw error;
}

export async function listDocuments(courseId: string) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadCourseDocument(input: {
  courseId: string;
  userId: string;
  file: File;
  category: "curriculum" | "previous_exams" | "other";
}) {
  const { courseId, userId, file, category } = input;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `حجم الملف (${(file.size / 1024 / 1024).toFixed(1)} ميغابايت) يتجاوز الحد المسموح وهو 200 ميغابايت. / File exceeds the 200MB limit.`,
    );
  }

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      course_id: courseId,
      uploaded_by: userId,
      file_name: file.name,
      storage_path: "pending",
      mime_type: file.type || "application/pdf",
      size_bytes: file.size,
      category,
      processing_status: "pending",
    })
    .select("id")
    .single();
  if (docError) throw docError;

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${courseId}/${doc.id}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(COURSE_BUCKET)
    .upload(path, file, { contentType: file.type || "application/pdf", upsert: true });

  if (uploadError) {
    await supabase
      .from("documents")
      .update({ processing_status: "failed", processing_error: uploadError.message })
      .eq("id", doc.id);
    throw uploadError;
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({ storage_path: path, processing_status: "uploaded" })
    .eq("id", doc.id);
  if (updateError) throw updateError;

  return doc.id;
}

export async function getDocumentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(COURSE_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function loadCurriculum(courseId: string) {
  const [units, lessons, objectives, activities, questions] = await Promise.all([
    supabase.from("units").select("*").eq("course_id", courseId).order("position"),
    supabase.from("lessons").select("*").eq("course_id", courseId).order("position"),
    supabase.from("objectives").select("*").eq("course_id", courseId).order("created_at"),
    supabase.from("activities").select("*").eq("course_id", courseId).order("position"),
    supabase.from("questions").select("*").eq("course_id", courseId).order("position"),
  ]);
  const first = [units, lessons, objectives, activities, questions].find((r) => r.error);
  if (first?.error) throw first.error;
  return {
    units: units.data ?? [],
    lessons: lessons.data ?? [],
    objectives: objectives.data ?? [],
    activities: activities.data ?? [],
    questions: questions.data ?? [],
  };
}

type ContentTable = "units" | "lessons" | "objectives" | "content_items" | "activities" | "questions";

export async function setItemStatus(
  table: ContentTable,
  id: string,
  status: "draft" | "approved" | "published" | "rejected",
) {
  const { error } = await supabase.from(table).update({ status }).eq("id", id);
  if (error) throw error;
}

export async function listEnrollments(courseId: string) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, student_id, created_at")
    .eq("course_id", courseId);
  if (error) throw error;
  return data ?? [];
}

export async function listStudentCourses() {
  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id, courses(id, title, subject, grade_level, content_language, status)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  // Students only ever see published courses.
  return (data ?? []).flatMap((row) =>
    row.courses && (row.courses as any).status === "published" ? [row.courses] : [],
  );
}

export async function listStudentActivities(courseId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("id, title, instructions, kind, lesson_id, position")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("position");
  if (error) throw error;
  return data ?? [];
}

export async function loadActivity(activityId: string) {
  const [activity, questions] = await Promise.all([
    supabase.from("activities").select("*").eq("id", activityId).maybeSingle(),
    supabase
      .from("questions")
      .select("id, stem, kind, options, points, position, objective_id")
      .eq("activity_id", activityId)
      .eq("status", "published")
      .order("position"),
  ]);
  if (activity.error) throw activity.error;
  if (questions.error) throw questions.error;
  return { activity: activity.data, questions: questions.data ?? [] };
}

export async function listMyAttempts(courseId?: string) {
  let query = supabase
    .from("attempts")
    .select("id, activity_id, course_id, score, max_score, submitted_at, started_at, teacher_comment")
    .order("started_at", { ascending: false });
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listMastery(studentId: string) {
  const { data, error } = await supabase
    .from("mastery_records")
    .select("id, objective_id, skill, mastery, evidence_count, correct_count, course_id")
    .eq("student_id", studentId);
  if (error) throw error;
  return data ?? [];
}

export async function listMyChildren() {
  const { data, error } = await supabase
    .from("parent_links")
    .select("id, student_id, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
