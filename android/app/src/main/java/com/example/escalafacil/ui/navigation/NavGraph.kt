package com.example.escalafacil.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.*
import kotlinx.serialization.Serializable

// Rotas Tipadas conforme especificação do Jetpack Navigation Compose
@Serializable object SchedulesRoute
@Serializable object ServicesRoute
@Serializable object MinistriesRoute
@Serializable object MembersRoute
@Serializable object AttendanceRoute
@Serializable data class ScheduleDetailRoute(val scheduleId: String)

sealed class BottomNavItem(val route: Any, val label: String) {
    object Schedules : BottomNavItem(SchedulesRoute, "Escalas")
    object Services : BottomNavItem(ServicesRoute, "Cultos")
    object Ministries : BottomNavItem(MinistriesRoute, "Ministérios")
    object Members : BottomNavItem(MembersRoute, "Voluntários")
    object Attendance : BottomNavItem(AttendanceRoute, "Presença")
}
