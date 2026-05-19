import { db } from './firebase';
import type { GroupActivity } from '../models/Activity';
import { warnUnlessPermissionDeniedAfterSignOut } from './firestoreErrorUtils';

const ACTIVITY_LIMIT_PER_GROUP = 20;

export const activityService = {
  subscribeToGroupsActivity(
    groupIds: string[],
    callback: (activities: GroupActivity[]) => void,
  ): () => void {
    if (groupIds.length === 0) {
      setTimeout(() => callback([]), 0);
      return () => {};
    }

    const activityById = new Map<string, GroupActivity>();
    const unsubscribeFns = groupIds.map(groupId => (
      db.collection('groups')
        .doc(groupId)
        .collection('activity')
        .orderBy('createdAt', 'desc')
        .limit(ACTIVITY_LIMIT_PER_GROUP)
        .onSnapshot(snapshot => {
          for (const change of snapshot.docChanges()) {
            const mapKey = `${groupId}/${change.doc.id}`;
            if (change.type === 'removed') {
              activityById.delete(mapKey);
            } else {
              activityById.set(mapKey, change.doc.data() as GroupActivity);
            }
          }

          const sorted = Array.from(activityById.values())
            .sort((a, b) => b.createdAt - a.createdAt);
          callback(sorted);
        }, error => {
          warnUnlessPermissionDeniedAfterSignOut('Error fetching group activity:', error);
        })
    ));

    return () => {
      unsubscribeFns.forEach(unsubscribe => unsubscribe());
    };
  },
};
