package com.example.escalafacil.data

import kotlinx.serialization.Serializable

@Serializable
data class Ministry(
    val id: String = "",
    val name: String = "",
    val locais: List<String> = emptyList() // Postos/funções específicas (ex: "Bateria", "Recepção Porta A")
)

@Serializable
data class Member(
    val id: String = "",
    val name: String = "",
    val cargo: String = "",              // ex: "Líder", "Músico", "Voluntário"
    val phone: String = "",
    val ministryId: String = "",
    val locais: List<String> = emptyList()
)

@Serializable
data class Service(
    val id: String = "",
    val label: String = ""               // ex: "Culto de Domingo Noite (19h)", "Quarta da Vitória"
)

@Serializable
data class Assignment(
    val id: String = "",
    val memberId: String = "",
    val local: String = "",
    val present: Boolean = false         // Controle de assiduidade/presença
)

@Serializable
data class Schedule(
    val id: String = "",
    val dateIso: String = "",            // YYYY-MM-DD
    val serviceId: String = "",
    val serviceLabel: String = "",
    val assignments: Map<String, List<Assignment>> = emptyMap(), // ministryId -> Lista de atribuições
    val note: String = "",
    val createdAt: Long = 0L
)
