package com.example.escalafacil.data

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class FirestoreRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    // Escuta em tempo real da coleção "schedules"
    fun getSchedulesFlow(): Flow<List<Schedule>> = callbackFlow {
        val listener = firestore.collection("schedules")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val list = snapshot?.toObjects(Schedule::class.java) ?: emptyList()
                trySend(list)
            }
        awaitClose { listener.remove() }
    }

    // Escuta da coleção "ministries"
    fun getMinistriesFlow(): Flow<List<Ministry>> = callbackFlow {
        val listener = firestore.collection("ministries")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val list = snapshot?.toObjects(Ministry::class.java) ?: emptyList()
                trySend(list)
            }
        awaitClose { listener.remove() }
    }

    // Escuta da coleção "members"
    fun getMembersFlow(): Flow<List<Member>> = callbackFlow {
        val listener = firestore.collection("members")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val list = snapshot?.toObjects(Member::class.java) ?: emptyList()
                trySend(list)
            }
        awaitClose { listener.remove() }
    }

    // Escuta da coleção "services"
    fun getServicesFlow(): Flow<List<Service>> = callbackFlow {
        val listener = firestore.collection("services")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val list = snapshot?.toObjects(Service::class.java) ?: emptyList()
                trySend(list)
            }
        awaitClose { listener.remove() }
    }

    suspend fun saveSchedule(schedule: Schedule) {
        val id = schedule.id.ifBlank { firestore.collection("schedules").document().id }
        firestore.collection("schedules").document(id)
            .set(schedule.copy(id = id))
            .await()
    }

    suspend fun deleteSchedule(id: String) {
        firestore.collection("schedules").document(id).delete().await()
    }

    suspend fun togglePresence(scheduleId: String, ministryId: String, assignmentId: String) {
        val docRef = firestore.collection("schedules").document(scheduleId)
        val snapshot = docRef.get().await()
        val schedule = snapshot.toObject(Schedule::class.java) ?: return

        val currentList = schedule.assignments[ministryId] ?: emptyList()
        val updatedList = currentList.map {
            if (it.id == assignmentId) it.copy(present = !it.present) else it
        }

        val updatedMap = schedule.assignments.toMutableMap().apply {
            put(ministryId, updatedList)
        }

        docRef.update("assignments", updatedMap).await()
    }
}
