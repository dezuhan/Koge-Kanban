/**
 * Utility functions to perform hard deletes (DROP data) on the backend.
 * These functions permanently remove rows from the database.
 */

const API_URL = 'http://localhost:3000/api/data';

/**
 * Permanently deletes a key and its value from the database.
 * This corresponds to a "DELETE FROM table WHERE key = ..." SQL command.
 * 
 * @param key The database key to drop (e.g., 'tasks_123')
 */
export const hardDeleteData = async (key: string): Promise<void> => {
    try {
        const response = await fetch(`${API_URL}/${key}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete data for key: ${key}`);
        }
        console.log(`Successfully dropped data for key: ${key}`);
    } catch (error) {
        console.error("Hard delete operation failed:", error);
        // We log error but don't stop execution flow to prevent UI freezing
    }
};

/**
 * Permanently drops all resources associated with a project.
 * This includes the tasks list and the columns configuration for that project.
 * 
 * @param projectId The ID of the project to clean up.
 */
export const dropProjectData = async (projectId: string) => {
    // We execute hard deletes for both the tasks and columns associated with this project.
    // This ensures no orphaned data remains in the database.
    await Promise.all([
        hardDeleteData(`tasks_${projectId}`),
        hardDeleteData(`columns_${projectId}`)
    ]);
};
