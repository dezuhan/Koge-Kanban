import { db } from '../services/db';

/**
 * Permanently drops all resources associated with a project.
 * This includes the tasks list and the columns configuration for that project.
 * 
 * @param projectId The ID of the project to clean up.
 */
export const dropProjectData = async (projectId: string) => {
    // We execute hard deletes for both the tasks and columns associated with this project.
    // This ensures no orphaned data remains in the database.
    
    // We utilize the central db service which now exposes delete functionality
    await Promise.all([
        db.deleteKey(`tasks_${projectId}`),
        db.deleteKey(`columns_${projectId}`)
    ]);
};