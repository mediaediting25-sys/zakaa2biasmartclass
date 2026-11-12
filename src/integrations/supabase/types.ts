export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          course_id: string
          created_at: string
          id: string
          instructions: string | null
          kind: string
          lesson_id: string | null
          position: number
          published_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          target_age: number | null
          target_grade: string | null
          target_topic: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          instructions?: string | null
          kind?: string
          lesson_id?: string | null
          position?: number
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          target_age?: number | null
          target_grade?: string | null
          target_topic?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          instructions?: string | null
          kind?: string
          lesson_id?: string | null
          position?: number
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          target_age?: number | null
          target_grade?: string | null
          target_topic?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          granted_by: string
          permission: string
          updated_at: string
          user_id: string
        }
        Insert: {
          granted_by: string
          permission: string
          updated_at?: string
          user_id: string
        }
        Update: {
          granted_by?: string
          permission?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          course_id: string
          created_at: string
          decision: string
          id: string
          question_id: string | null
          reason: string | null
          snapshot: Json | null
          teacher_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          decision: string
          id?: string
          question_id?: string | null
          reason?: string | null
          snapshot?: Json | null
          teacher_id?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          decision?: string
          id?: string
          question_id?: string | null
          reason?: string | null
          snapshot?: Json | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_jobs: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          document_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          job_type: string
          model: string | null
          provider: string | null
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string
          document_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          model?: string | null
          provider?: string | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          document_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          model?: string | null
          provider?: string | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          response: Json | null
          score: number | null
          student_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          response?: Json | null
          score?: number | null
          student_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          response?: Json | null
          score?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          activity_id: string
          commented_at: string | null
          course_id: string
          created_at: string
          id: string
          max_score: number | null
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
          teacher_comment: string | null
        }
        Insert: {
          activity_id: string
          commented_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          max_score?: number | null
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
          teacher_comment?: string | null
        }
        Update: {
          activity_id?: string
          commented_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          max_score?: number | null
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_accounts: {
        Row: {
          blocked_at: string
          blocked_by: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          user_id?: string
        }
        Relationships: []
      }
      class_members: {
        Row: {
          class_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          grade_level: string | null
          id: string
          name: string
          org_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_level?: string | null
          id?: string
          name: string
          org_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_level?: string | null
          id?: string
          name?: string
          org_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          body: string | null
          confidence: number | null
          course_id: string
          created_at: string
          id: string
          kind: string
          lesson_id: string
          position: number
          source_document_id: string | null
          source_page: number | null
          status: Database["public"]["Enums"]["content_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          confidence?: number | null
          course_id: string
          created_at?: string
          id?: string
          kind?: string
          lesson_id: string
          position?: number
          source_document_id?: string | null
          source_page?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          confidence?: number | null
          course_id?: string
          created_at?: string
          id?: string
          kind?: string
          lesson_id?: string
          position?: number
          source_document_id?: string | null
          source_page?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          description: string | null
          file_name: string | null
          id: string
          kind: string
          link_url: string | null
          mime_type: string | null
          size_bytes: number | null
          status: string
          storage_path: string | null
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_name?: string | null
          id?: string
          kind: string
          link_url?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_name?: string | null
          id?: string
          kind?: string
          link_url?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_plans: {
        Row: {
          course_id: string
          created_at: string
          end_date: string
          period: string
          review_per_unit: boolean
          schedule: Json
          sessions_per_period: number
          start_date: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          end_date: string
          period?: string
          review_per_unit?: boolean
          schedule?: Json
          sessions_per_period?: number
          start_date: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          end_date?: string
          period?: string
          review_per_unit?: boolean
          schedule?: Json
          sessions_per_period?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          content_language: string
          cover_color: string | null
          created_at: string
          description: string | null
          grade_level: string | null
          id: string
          join_code: string | null
          org_id: string | null
          status: Database["public"]["Enums"]["course_status"]
          subject: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content_language?: string
          cover_color?: string | null
          created_at?: string
          description?: string | null
          grade_level?: string | null
          id?: string
          join_code?: string | null
          org_id?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          subject?: string | null
          teacher_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          content_language?: string
          cover_color?: string | null
          created_at?: string
          description?: string | null
          grade_level?: string | null
          id?: string
          join_code?: string | null
          org_id?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          subject?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["doc_category"]
          course_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          page_count: number | null
          processing_error: string | null
          processing_status: Database["public"]["Enums"]["doc_status"]
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["doc_category"]
          course_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          page_count?: number | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["doc_status"]
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["doc_category"]
          course_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          page_count?: number | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["doc_status"]
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string | null
          course_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          course_id: string | null
          created_at: string
          decided_at: string | null
          id: string
          message: string | null
          requested_by: string
          status: string
          student_id: string
          student_name: string | null
          subject: string | null
          teacher_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string | null
          requested_by: string
          status?: string
          student_id: string
          student_name?: string | null
          subject?: string | null
          teacher_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string | null
          requested_by?: string
          status?: string
          student_id?: string
          student_name?: string | null
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_presentations: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          id: string
          language: string
          lesson_id: string
          published_at: string | null
          slides: Json
          status: Database["public"]["Enums"]["content_status"]
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by: string
          id?: string
          language?: string
          lesson_id: string
          published_at?: string | null
          slides?: Json
          status?: Database["public"]["Enums"]["content_status"]
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          id?: string
          language?: string
          lesson_id?: string
          published_at?: string | null
          slides?: Json
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_presentations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_presentations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          confidence: number | null
          course_id: string
          created_at: string
          id: string
          position: number
          source_document_id: string | null
          source_page: number | null
          source_quote: string | null
          status: Database["public"]["Enums"]["content_status"]
          summary: string | null
          title: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          course_id: string
          created_at?: string
          id?: string
          position?: number
          source_document_id?: string | null
          source_page?: number | null
          source_quote?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          source_document_id?: string | null
          source_page?: number | null
          source_quote?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          summary?: string | null
          title?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_records: {
        Row: {
          correct_count: number
          course_id: string
          created_at: string
          evidence_count: number
          id: string
          mastery: number
          objective_id: string | null
          skill: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          correct_count?: number
          course_id: string
          created_at?: string
          evidence_count?: number
          id?: string
          mastery?: number
          objective_id?: string | null
          skill?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          correct_count?: number
          course_id?: string
          created_at?: string
          evidence_count?: number
          id?: string
          mastery?: number
          objective_id?: string | null
          skill?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_records_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_records_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      objectives: {
        Row: {
          code: string | null
          confidence: number | null
          course_id: string
          created_at: string
          description: string
          id: string
          lesson_id: string | null
          skill: string | null
          source_document_id: string | null
          source_page: number | null
          source_quote: string | null
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          code?: string | null
          confidence?: number | null
          course_id: string
          created_at?: string
          description: string
          id?: string
          lesson_id?: string | null
          skill?: string | null
          source_document_id?: string | null
          source_page?: number | null
          source_quote?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          code?: string | null
          confidence?: number | null
          course_id?: string
          created_at?: string
          description?: string
          id?: string
          lesson_id?: string | null
          skill?: string | null
          source_document_id?: string | null
          source_page?: number | null
          source_quote?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      parent_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          status: Database["public"]["Enums"]["link_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          status?: Database["public"]["Enums"]["link_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          status?: Database["public"]["Enums"]["link_status"]
          student_id?: string
        }
        Relationships: []
      }
      platform_owners: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          ui_locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          ui_locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          ui_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          activity_id: string
          confidence: number | null
          correct_answer: Json | null
          course_id: string
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          kind: string
          objective_id: string | null
          options: Json | null
          points: number
          position: number
          source_document_id: string | null
          source_page: number | null
          source_quote: string | null
          status: Database["public"]["Enums"]["content_status"]
          stem: string
          updated_at: string
          verification: Json | null
        }
        Insert: {
          activity_id: string
          confidence?: number | null
          correct_answer?: Json | null
          course_id: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          kind?: string
          objective_id?: string | null
          options?: Json | null
          points?: number
          position?: number
          source_document_id?: string | null
          source_page?: number | null
          source_quote?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          stem: string
          updated_at?: string
          verification?: Json | null
        }
        Update: {
          activity_id?: string
          confidence?: number | null
          correct_answer?: Json | null
          course_id?: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          kind?: string
          objective_id?: string | null
          options?: Json | null
          points?: number
          position?: number
          source_document_id?: string | null
          source_page?: number | null
          source_quote?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          stem?: string
          updated_at?: string
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      retake_grants: {
        Row: {
          activity_id: string
          consumed_at: string | null
          created_at: string
          granted_by: string
          id: string
          student_id: string
        }
        Insert: {
          activity_id: string
          consumed_at?: string | null
          created_at?: string
          granted_by: string
          id?: string
          student_id: string
        }
        Update: {
          activity_id?: string
          consumed_at?: string | null
          created_at?: string
          granted_by?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retake_grants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit: {
        Row: {
          actor_id: string
          created_at: string
          granted: boolean
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          granted: boolean
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          granted?: boolean
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_id?: string
        }
        Relationships: []
      }
      role_choices: {
        Row: {
          chosen_at: string
          user_id: string
        }
        Insert: {
          chosen_at?: string
          user_id: string
        }
        Update: {
          chosen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      source_chunks: {
        Row: {
          chunk_index: number
          content: string
          course_id: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          page_number: number
        }
        Insert: {
          chunk_index: number
          content: string
          course_id: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          page_number: number
        }
        Update: {
          chunk_index?: number
          content?: string
          course_id?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_chunks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      source_pages: {
        Row: {
          created_at: string
          document_id: string
          id: string
          needs_ocr: boolean
          page_number: number
          text_content: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          needs_ocr?: boolean
          page_number: number
          text_content?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          needs_ocr?: boolean
          page_number?: number
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      student_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          student_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          student_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          student_id?: string
        }
        Relationships: []
      }
      teacher_listings: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          grade_levels: string | null
          is_listed: boolean
          photo_path: string | null
          subjects: string[]
          teacher_id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name: string
          grade_levels?: string | null
          is_listed?: boolean
          photo_path?: string | null
          subjects?: string[]
          teacher_id: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          grade_levels?: string | null
          is_listed?: boolean
          photo_path?: string | null
          subjects?: string[]
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          confidence: number | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          source_document_id: string | null
          source_page: number | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          source_document_id?: string | null
          source_page?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          source_document_id?: string | null
          source_page?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_accounts: {
        Args: never
        Returns: {
          email: string
          full_name: string
          is_blocked: boolean
          is_owner: boolean
          roles: string[]
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          email: string
          full_name: string
          is_owner: boolean
          roles: string[]
          user_id: string
        }[]
      }
      admin_set_blocked: {
        Args: { _blocked: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      can_read_course_content: {
        Args: { _course_id: string }
        Returns: boolean
      }
      child_report: { Args: { _student_id: string }; Returns: Json }
      choose_my_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      course_is_published: { Args: { _course_id: string }; Returns: boolean }
      decide_join_request: {
        Args: { _approve: boolean; _course_id: string; _request_id: string }
        Returns: undefined
      }
      delete_rejected_question: {
        Args: { _question_id: string }
        Returns: undefined
      }
      get_my_link_code: { Args: { _regenerate?: boolean }; Returns: string }
      has_admin_permission: { Args: { _permission: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_blocked: { Args: never; Returns: boolean }
      is_class_teacher: { Args: { _class_id: string }; Returns: boolean }
      is_course_teacher: { Args: { _course_id: string }; Returns: boolean }
      is_enrolled: {
        Args: { _course_id: string; _user_id?: string }
        Returns: boolean
      }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      is_parent_of: { Args: { _student_id: string }; Returns: boolean }
      is_platform_owner: { Args: never; Returns: boolean }
      join_course: { Args: { _code: string }; Returns: string }
      list_my_children: {
        Args: never
        Returns: {
          email: string
          full_name: string
          linked_at: string
          student_id: string
        }[]
      }
      match_source_chunks: {
        Args: { _count?: number; _course_id: string; _query: string }
        Returns: {
          content: string
          document_id: string
          id: string
          page_number: number
          similarity: number
        }[]
      }
      redeem_link_code: { Args: { _code: string }; Returns: string }
      set_admin_permission: {
        Args: { _grant: boolean; _permission: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student" | "parent"
      content_status: "draft" | "approved" | "published" | "rejected"
      course_status: "draft" | "published" | "archived"
      doc_category: "curriculum" | "previous_exams" | "other"
      doc_status: "pending" | "uploaded" | "processing" | "processed" | "failed"
      job_status: "queued" | "running" | "succeeded" | "failed"
      link_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "student", "parent"],
      content_status: ["draft", "approved", "published", "rejected"],
      course_status: ["draft", "published", "archived"],
      doc_category: ["curriculum", "previous_exams", "other"],
      doc_status: ["pending", "uploaded", "processing", "processed", "failed"],
      job_status: ["queued", "running", "succeeded", "failed"],
      link_status: ["pending", "approved", "rejected"],
    },
  },
} as const
