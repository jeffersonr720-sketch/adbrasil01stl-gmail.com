import jsPDF from 'jspdf';
import { Member, Ministry, Schedule } from '../types';
import { AD_LOGO_BASE64 } from './logoBase64';

export function generateSchedulePdf(
  schedule: Schedule,
  ministries: Ministry[],
  members: Member[],
  churchName: string = 'Assembleia de Deus • AD Brasil'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 14;

  // Header background banner (AD Brasil Green #2F9B45)
  doc.setFillColor(47, 155, 69); // #2F9B45
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, 'F');

  // Gold accent line under the green banner (#F7B13D)
  doc.setFillColor(247, 177, 61); // #F7B13D
  doc.rect(margin, y + 27, pageWidth - margin * 2, 1.5, 'F');

  // Embed AD Brasil Logo
  try {
    // Logo is 400x326, aspect ratio approx 1.22
    const logoW = 26;
    const logoH = 21.2;
    // White background pill for the logo inside header
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + 4, y + 3.4, logoW + 4, logoH + 1.2, 2, 2, 'F');
    doc.addImage(AD_LOGO_BASE64, 'PNG', margin + 6, y + 4, logoW, logoH);
  } catch (err) {
    console.warn('Erro ao carregar logotipo no PDF:', err);
  }

  // Header Titles
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('ESCALA DE VOLUNTÁRIOS', margin + 38, y + 10);

  doc.setFontSize(10.5);
  doc.text(churchName.toUpperCase(), margin + 38, y + 16);

  // Subtitle / Date / Culto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const parts = schedule.dateIso.split('-');
  const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : schedule.dateIso;
  doc.text(`Data: ${dateFormatted}   |   Culto: ${schedule.serviceLabel}`, margin + 38, y + 22);

  y += 37;

  // Table of Ministries & Volunteers
  let hasAny = false;

  ministries.forEach((min) => {
    const list = schedule.assignments[min.id] || [];
    if (list.length === 0) return;
    hasAny = true;

    // Check if we need a new page
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 16;
    }

    // Ministry header with Green accent and Gold pill
    doc.setFillColor(240, 249, 242); // very soft green
    doc.setDrawColor(47, 155, 69); // green border
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 8.5, 2, 2, 'FD');

    // Mini gold indicator square
    doc.setFillColor(247, 177, 61);
    doc.rect(margin + 2.5, y + 2.2, 3, 4.2, 'F');

    doc.setTextColor(27, 105, 43); // dark green text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(min.name.toUpperCase(), margin + 8, y + 5.8);

    // Volunteer count in section
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 110, 95);
    doc.text(`${list.length} escalado(s)`, pageWidth - margin - 22, y + 5.8);

    y += 10.5;

    // Table rows
    list.forEach((assign, idx) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 16;
      }

      const member = members.find((m) => m.id === assign.memberId);
      const memberName = member ? member.name : 'Vago / Não Definido';
      const cargo = member && member.cargo ? ` • ${member.cargo}` : '';

      // Zebra striping with subtle cream/green
      if (idx % 2 === 0) {
        doc.setFillColor(249, 251, 249);
        doc.rect(margin, y - 4, pageWidth - margin * 2, 7.5, 'F');
      }

      // Local / Função (Bold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(assign.local, margin + 4, y + 1);

      // Volunteer Name & Cargo
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`${memberName}${cargo}`, margin + 65, y + 1);

      // Presence status indicator text
      doc.setFontSize(8);
      if (assign.present) {
        doc.setTextColor(34, 139, 34); // Forest Green
        doc.setFont('helvetica', 'bold');
        doc.text('✓ [Confirmado]', pageWidth - margin - 28, y + 1);
      } else {
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text('○ [Pendente]', pageWidth - margin - 25, y + 1);
      }

      // Light separator line
      doc.setDrawColor(228, 235, 230);
      doc.setLineWidth(0.15);
      doc.line(margin, y + 3.5, pageWidth - margin, y + 3.5);

      y += 7.5;
    });

    y += 4;
  });

  if (!hasAny) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(10);
    doc.text('Nenhum voluntário escalado ainda neste culto.', margin + 4, y + 5);
    y += 15;
  }

  // Notes & Pastoral Orientations box
  if (schedule.note && schedule.note.trim().length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 16;
    }

    doc.setFillColor(255, 251, 240); // Soft gold tint
    doc.setDrawColor(247, 177, 61); // Gold border
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'FD');

    doc.setTextColor(180, 110, 10); // Amber title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('📌 OBSERVAÇÕES & ORIENTAÇÕES PASTORAIS:', margin + 4, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8.5);
    const splitNotes = doc.splitTextToSize(schedule.note, pageWidth - margin * 2 - 8);
    doc.text(splitNotes, margin + 4, y + 11.5);

    y += 28;
  }

  // Signatures section at bottom
  if (y > pageHeight - 38) {
    doc.addPage();
    y = 20;
  } else {
    y = Math.max(y + 8, pageHeight - 36);
  }

  doc.setDrawColor(180, 195, 185);
  doc.setLineWidth(0.3);

  const colWidth = (pageWidth - margin * 2 - 20) / 2;

  // Signature 1
  doc.line(margin + 5, y + 8, margin + 5 + colWidth, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text('Pastor / Líder Geral', margin + 5 + colWidth / 4, y + 12);

  // Signature 2
  doc.line(margin + 15 + colWidth, y + 8, margin + 15 + colWidth * 2, y + 8);
  doc.text('Coordenador da Escala', margin + 15 + colWidth + colWidth / 4, y + 12);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(130, 140, 135);
  doc.text(
    `Assembleia de Deus • Escala Fácil • Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • "Tudo para a Glória de Deus"`,
    margin,
    pageHeight - 6
  );

  // Save the PDF
  const cleanDate = schedule.dateIso.replace(/-/g, '');
  const cleanTitle = schedule.serviceLabel.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
  doc.save(`Escala_AD_Brasil_${cleanDate}_${cleanTitle}.pdf`);
}
