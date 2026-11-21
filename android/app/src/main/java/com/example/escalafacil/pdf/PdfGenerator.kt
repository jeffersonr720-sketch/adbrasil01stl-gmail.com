package com.example.escalafacil.pdf

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.example.escalafacil.data.Member
import com.example.escalafacil.data.Ministry
import com.example.escalafacil.data.Schedule
import java.io.File
import java.io.FileOutputStream

object PdfGenerator {

    fun generateAndSharePdf(
        context: Context,
        schedule: Schedule,
        ministries: List<Ministry>,
        members: List<Member>,
        churchName: String = "Igreja Vida & Fé"
    ) {
        val pdfDocument = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create() // A4 em 72 dpi
        val page = pdfDocument.startPage(pageInfo)
        val canvas = page.canvas

        val paint = Paint().apply { isAntiAlias = true }

        // Header Background
        paint.color = Color.parseColor("#6750A4")
        canvas.drawRoundRect(20f, 20f, 575f, 90f, 12f, 12f, paint)

        // Header Texts
        paint.color = Color.WHITE
        paint.textSize = 20f
        paint.isFakeBoldText = true
        canvas.drawText("ESCALA FÁCIL • ${churchName.uppercase()}", 35f, 55f, paint)

        paint.textSize = 12f
        paint.isFakeBoldText = false
        canvas.drawText("Data: ${schedule.dateIso}  |  Culto: ${schedule.serviceLabel}", 35f, 75f, paint)

        var yPos = 120f

        ministries.forEach { ministry ->
            val assigns = schedule.assignments[ministry.id] ?: emptyList()
            if (assigns.isNotEmpty()) {
                // Section Title
                paint.color = Color.parseColor("#6750A4")
                paint.textSize = 13f
                paint.isFakeBoldText = true
                canvas.drawText(ministry.name.uppercase(), 25f, yPos, paint)
                yPos += 15f

                assigns.forEach { assign ->
                    val member = members.find { it.id == assign.memberId }
                    val name = member?.name ?: "Vago"
                    val cargo = member?.cargo?.let { " ($it)" } ?: ""

                    paint.color = Color.DKGRAY
                    paint.textSize = 11f
                    paint.isFakeBoldText = true
                    canvas.drawText("• ${assign.local}:", 35f, yPos, paint)

                    paint.isFakeBoldText = false
                    paint.color = Color.BLACK
                    canvas.drawText("$name$cargo", 180f, yPos, paint)

                    if (assign.present) {
                        paint.color = Color.parseColor("#1B5E20")
                        canvas.drawText("[Presente]", 480f, yPos, paint)
                    }

                    yPos += 18f
                }
                yPos += 12f
            }
        }

        // Observações
        if (schedule.note.isNotBlank()) {
            paint.color = Color.parseColor("#49454F")
            paint.textSize = 11f
            paint.isFakeBoldText = true
            canvas.drawText("Orientações:", 25f, yPos, paint)
            yPos += 15f

            paint.isFakeBoldText = false
            canvas.drawText(schedule.note, 25f, yPos, paint)
            yPos += 25f
        }

        pdfDocument.finishPage(page)

        // Salvar em cache e compartilhar via FileProvider
        val file = File(context.cacheDir, "escala_${schedule.dateIso}.pdf")
        val outputStream = FileOutputStream(file)
        pdfDocument.writeTo(outputStream)
        pdfDocument.close()
        outputStream.close()

        val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(shareIntent, "Compartilhar Escala em PDF"))
    }
}
