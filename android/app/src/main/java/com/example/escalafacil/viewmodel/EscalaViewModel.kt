package com.example.escalafacil.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.escalafacil.data.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class EscalaUiState(
    val schedules: List<Schedule> = emptyList(),
    val ministries: List<Ministry> = emptyList(),
    val members: List<Member> = emptyList(),
    val services: List<Service> = emptyList(),
    val selectedSchedule: Schedule? = null,
    val isLoading: Boolean = false,
    val userMessage: String? = null
)

class EscalaViewModel(
    private val repository: FirestoreRepository = FirestoreRepository()
) : ViewModel() {

    private val _selectedScheduleId = MutableStateFlow<String?>(null)
    private val _userMessage = MutableStateFlow<String?>(null)
    private val _isLoading = MutableStateFlow(false)

    // Reatividade MVVM combinando StateFlows do Firestore com WhileSubscribed(5000)
    val uiState: StateFlow<EscalaUiState> = combine(
        repository.getSchedulesFlow(),
        repository.getMinistriesFlow(),
        repository.getMembersFlow(),
        repository.getServicesFlow(),
        _selectedScheduleId,
        _isLoading,
        _userMessage
    ) { schedules, ministries, members, services, selectedId, loading, msg ->
        val selected = schedules.find { it.id == selectedId }
        EscalaUiState(
            schedules = schedules,
            ministries = ministries,
            members = members,
            services = services,
            selectedSchedule = selected,
            isLoading = loading,
            userMessage = msg
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = EscalaUiState(isLoading = true)
    )

    fun selectSchedule(id: String?) {
        _selectedScheduleId.value = id
    }

    fun togglePresence(scheduleId: String, ministryId: String, assignmentId: String) {
        viewModelScope.launch {
            repository.togglePresence(scheduleId, ministryId, assignmentId)
        }
    }

    fun saveSchedule(schedule: Schedule) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.saveSchedule(schedule)
            _isLoading.value = false
            _userMessage.value = "Escala salva com sucesso!"
        }
    }

    fun deleteSchedule(id: String) {
        viewModelScope.launch {
            repository.deleteSchedule(id)
            _userMessage.value = "Escala excluída"
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }
}
