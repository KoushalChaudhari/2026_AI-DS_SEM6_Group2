/**
 * Validation schemas for the new curriculum_scheme table
 * Using Zod for runtime type safety and API request/response validation
 */

import { z } from 'zod';

/**
 * Subject ID parameter (for routes like PUT /:id, DELETE /:id)
 */
export const subjectIdSchema = z.object({
    id: z.coerce.number().int().positive('Subject ID must be a positive integer')
});

/**
 * Branch ID parameter (for import routes)
 */
export const branchIdSchema = z.object({
    branchId: z.coerce.number().int().positive('Branch ID must be a positive integer')
});

/**
 * Assessment marks schema - each mark field can be individually nullable
 * Represents the four components of exam marks:
 * - iat_max_marks: Internal Assessment Test (Sem 3-4: 40, Sem 5-6: 20)
 * - end_sem_max_marks: End Semester Exam (NULL for Lab subjects)
 * - tw_max_marks: Term Work
 * - oral_pr_max_marks: Oral & Practical
 */
const assessmentMarksSchema = z.object({
    iat_max_marks: z.number().int().min(1).nullable().optional(),
    end_sem_max_marks: z.number().int().min(1).nullable().optional(),
    tw_max_marks: z.number().int().min(1).nullable().optional(),
    oral_pr_max_marks: z.number().int().min(1).nullable().optional(),
    total_max_marks: z.number().int().positive('Total marks must be greater than 0')
}).refine(
    (data) => {
        // Validate: total_max_marks must equal sum of non-null assessment columns
        const sum = (data.iat_max_marks || 0) + 
                   (data.end_sem_max_marks || 0) + 
                   (data.tw_max_marks || 0) + 
                   (data.oral_pr_max_marks || 0);
        return data.total_max_marks === sum;
    },
    {
        message: 'total_max_marks must equal the sum of IA total/avg, end semester, term work, and oral/practical marks',
        path: ['total_max_marks']
    }
);

/**
 * Create curriculum subject schema
 * Used for POST /curriculum and PUT /curriculum/:id
 */
export const createCurriculumSubjectSchema = z.object({
    branch_id: z.coerce.number().int().positive('Branch ID is required'),
    semester: z.coerce.number().int().min(1).max(8, 'Semester must be between 1 and 8'),
    course_code: z.string()
        .trim()
        .min(1, 'Course code is required')
        .max(20, 'Course code must not exceed 20 characters'),
    course_name: z.string()
        .trim()
        .min(1, 'Course name is required')
        .max(255, 'Course name must not exceed 255 characters'),
    is_elective: z.coerce.boolean().default(false),
    ...assessmentMarksSchema.shape
}).merge(assessmentMarksSchema);

/**
 * Update curriculum subject schema (same as create for now)
 */
export const updateCurriculumSubjectSchema = createCurriculumSubjectSchema;

/**
 * Query filters for GET /curriculum
 * Supports flexible filtering by branch, semester, exam type, assessment type, and search
 */
export const curriculumQuerySchema = z.object({
    branchId: z.coerce.number().int().positive().optional(),
    semester: z.coerce.number().int().min(1).max(8).optional(),
    examType: z.enum(['theory', 'lab']).optional(),
    assessmentType: z.enum(['iat', 'term_work', 'oral']).optional(),
    isElective: z.coerce.boolean().optional(),
    search: z.string().trim().max(100).optional()
});

/**
 * Timetable generation schema
 * Used for POST /curriculum/timetable/generate
 */
export const timetableGenerateSchema = z.object({
    branch_id: z.coerce.number().int().positive(),
    exam_type: z.enum(['theory', 'lab']),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    session1_time: z.string().trim().min(3).max(100),
    session2_time: z.string().trim().min(3).max(100)
});

/**
 * Response schema for GET /curriculum/:id
 * Includes database-generated fields like is_lab, has_iat, has_term_work, has_oral_pr
 */
export const curriculumSubjectResponseSchema = createCurriculumSubjectSchema.extend({
    subject_id: z.number().int().positive(),
    is_lab: z.boolean().describe('Generated: true if end_sem_max_marks is NULL'),
    has_iat: z.boolean().describe('Generated: true if iat_max_marks is not NULL'),
    has_term_work: z.boolean().describe('Generated: true if tw_max_marks is not NULL'),
    has_oral_pr: z.boolean().describe('Generated: true if oral_pr_max_marks is not NULL'),
    branch_id: z.number().int(),
    branch_code: z.string(),
    branch_name: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});

/**
 * Import file validation schema
 * Validates rows from Excel files during bulk import
 */
export const curriculumImportRowSchema = z.object({
    course_code: z.string().trim().min(1, 'course_code is required'),
    course_name: z.string().trim().min(1, 'course_name is required'),
    semester: z.number().int().min(1).max(8),
    iat_max_marks: z.number().int().min(1).nullable(),
    end_sem_max_marks: z.number().int().min(1).nullable(),
    tw_max_marks: z.number().int().min(1).nullable(),
    oral_pr_max_marks: z.number().int().min(1).nullable(),
    total_max_marks: z.number().int().positive(),
    is_elective: z.boolean()
}).refine(
    (row) => {
        const sum = (row.iat_max_marks || 0) + 
                   (row.end_sem_max_marks || 0) + 
                   (row.tw_max_marks || 0) + 
                   (row.oral_pr_max_marks || 0);
        return row.total_max_marks === sum;
    },
    {
        message: 'total_max_marks must equal the sum of IA total/avg, end semester, term work, and oral/practical marks',
        path: ['total_max_marks']
    }
);

/**
 * Lab detection helper
 * A subject is a lab if end_sem_max_marks is NULL
 */
export function isLabSubject(subject) {
    return subject.end_sem_max_marks === null;
}

/**
 * Utility to validate assessment marks sum
 */
export function validateAssessmentMarksSum(iat, endSem, tw, oralPr) {
    return (iat || 0) + (endSem || 0) + (tw || 0) + (oralPr || 0);
}

/**
 * Filter helper for frontend to check assessment types
 */
export function hasAssessmentType(subject, type) {
    switch (type) {
        case 'iat':
            return subject.iat_max_marks !== null && subject.iat_max_marks !== undefined;
        case 'term_work':
            return subject.tw_max_marks !== null && subject.tw_max_marks !== undefined;
        case 'oral':
            return subject.oral_pr_max_marks !== null && subject.oral_pr_max_marks !== undefined;
        default:
            return false;
    }
}
