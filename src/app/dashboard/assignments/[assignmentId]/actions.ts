'use server';

import { adminFirestore } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/auth/server';

export async function deleteAssignment(assignmentId: string) {
  try {
    const user = await getAuthenticatedUser();
    
    if (!user || !user.coachId) {
      return { success: false, error: 'Unauthorized' };
    }

    const firestore = adminFirestore();
    const assignmentRef = firestore.collection('assignments').doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();

    if (!assignmentDoc.exists) {
      return { success: false, error: 'Assignment not found' };
    }

    const assignment = assignmentDoc.data();
    
    // Verify the coach owns this assignment
    if (assignment?.coachId !== user.coachId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Delete the assignment
    await assignmentRef.delete();

    return { success: true };
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete assignment' 
    };
  }
}

