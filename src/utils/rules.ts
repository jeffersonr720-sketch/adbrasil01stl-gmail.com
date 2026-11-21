import { Assignment, Member, Ministry, Schedule, Service, ConflictInfo } from '../types';

/**
 * Formata os dados de uma escala em uma mensagem rica para WhatsApp
 * com negritos (*texto*), emojis e quebras de linha ideais para grupos de igreja.
 */
export function formatWhatsAppMessage(
  schedule: Schedule,
  ministries: Ministry[],
  members: Member[],
  churchName: string = 'Assembleia de Deus • AD Brasil'
): string {
  // Formatar data: YYYY-MM-DD para DD/MM/YYYY
  const parts = schedule.dateIso.split('-');
  const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : schedule.dateIso;

  const lines: string[] = [
    `📋 *ESCALA DE VOLUNTÁRIOS - ${churchName.toUpperCase()}*`,
    `🗓️ *Data:* ${formattedDate}`,
    `⏰ *Culto:* ${schedule.serviceLabel}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  ];

  // Agrupar por ministério
  let hasAnyAssignment = false;

  ministries.forEach((min) => {
    const list = schedule.assignments[min.id] || [];
    if (list.length > 0) {
      hasAnyAssignment = true;
      lines.push(``);
      lines.push(`🔰 *${min.name.toUpperCase()}*`);

      list.forEach((assignment) => {
        const member = members.find((m) => m.id === assignment.memberId);
        const memberName = member ? member.name : 'Não informado';
        const cargoBadge = member && member.cargo ? ` (${member.cargo})` : '';
        lines.push(`• *${assignment.local}:* ${memberName}${cargoBadge}`);
      });
    }
  });

  if (!hasAnyAssignment) {
    lines.push(``);
    lines.push(`_Nenhum voluntário escalado ainda._`);
  }

  if (schedule.note && schedule.note.trim().length > 0) {
    lines.push(``);
    lines.push(`📌 *Observações & Orientações:*`);
    lines.push(schedule.note.trim());
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🙏 _"Tudo o que fizerem, façam de todo o coração, como para o Senhor."_ (Colossenses 3:23)`);
  lines.push(`⚠️ _Favor confirmar presença até 24h antes do culto!_`);

  return lines.join('\n');
}

/**
 * Cria a URL direta para enviar para o WhatsApp
 */
export function getWhatsAppShareUrl(text: string, phone?: string): string {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Detecta conflitos de escala:
 * Membros atribuídos a múltiplos postos no mesmo culto ou mesma data
 */
export function detectScheduleConflicts(
  schedule: Schedule,
  members: Member[]
): ConflictInfo[] {
  const memberCounts: Record<string, { locais: string[]; ministryIds: string[] }> = {};

  Object.entries(schedule.assignments).forEach(([ministryId, assignments]) => {
    assignments.forEach((assignment) => {
      if (!assignment.memberId) return;

      if (!memberCounts[assignment.memberId]) {
        memberCounts[assignment.memberId] = { locais: [], ministryIds: [] };
      }
      memberCounts[assignment.memberId].locais.push(assignment.local);
      if (!memberCounts[assignment.memberId].ministryIds.includes(ministryId)) {
        memberCounts[assignment.memberId].ministryIds.push(ministryId);
      }
    });
  });

  const conflicts: ConflictInfo[] = [];

  Object.entries(memberCounts).forEach(([memberId, data]) => {
    if (data.locais.length > 1) {
      const member = members.find((m) => m.id === memberId);
      conflicts.push({
        memberId,
        memberName: member ? member.name : 'Membro',
        scheduleId: schedule.id,
        serviceLabel: schedule.serviceLabel,
        dateIso: schedule.dateIso,
        ministryIds: data.ministryIds,
        locais: data.locais
      });
    }
  });

  return conflicts;
}

/**
 * Calcula taxa de presença / assiduidade dos membros
 */
export function calculateMemberStats(
  memberId: string,
  schedules: Schedule[]
): { totalAssigned: number; totalPresent: number; attendanceRate: number } {
  let totalAssigned = 0;
  let totalPresent = 0;

  schedules.forEach((sch) => {
    Object.values(sch.assignments).forEach((list) => {
      list.forEach((item) => {
        if (item.memberId === memberId) {
          totalAssigned += 1;
          if (item.present) {
            totalPresent += 1;
          }
        }
      });
    });
  });

  const attendanceRate = totalAssigned > 0 ? Math.round((totalPresent / totalAssigned) * 100) : 100;

  return { totalAssigned, totalPresent, attendanceRate };
}

/**
 * Exporta todas as escalas e presenças para formato CSV (Excel / Planilhas)
 */
export function exportSchedulesToCsv(
  schedules: Schedule[],
  ministries: Ministry[],
  members: Member[]
): string {
  const headers = ['Data', 'Culto', 'Ministério', 'Posto/Função', 'Voluntário', 'Cargo', 'Telefone', 'Presença'];
  const rows: string[][] = [];

  schedules.forEach((sch) => {
    Object.entries(sch.assignments).forEach(([minId, list]) => {
      const min = ministries.find((m) => m.id === minId);
      const minName = min ? min.name : minId;

      list.forEach((assign) => {
        const member = members.find((m) => m.id === assign.memberId);
        rows.push([
          sch.dateIso,
          `"${sch.serviceLabel.replace(/"/g, '""')}"`,
          `"${minName.replace(/"/g, '""')}"`,
          `"${assign.local.replace(/"/g, '""')}"`,
          `"${(member ? member.name : 'Vago').replace(/"/g, '""')}"`,
          `"${(member?.cargo || '').replace(/"/g, '""')}"`,
          `"${(member?.phone || '').replace(/"/g, '""')}"`,
          assign.present ? 'Confirmado' : 'Pendente'
        ]);
      });
    });
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return '\uFEFF' + csvContent; // BOM for UTF-8 in Excel
}


/**
 * Dados iniciais de demonstração (seed data) para a igreja
 */
export function getInitialSeedData(): {
  ministries: Ministry[];
  members: Member[];
  services: Service[];
  schedules: Schedule[];
} {
  const ministries: Ministry[] = [
    {
      id: 'min-louvor',
      name: 'Louvor & Adoração',
      locais: ['Voz Líder', 'Backing Vocal 1', 'Backing Vocal 2', 'Teclado / Piano', 'Violão Acústico', 'Guitarra', 'Baixo Elétrico', 'Bateria'],
      color: '#2F9B45' // AD Brasil Green
    },
    {
      id: 'min-midia',
      name: 'Mídia & Transmissão',
      locais: ['Mesa de Som (FOH)', 'Transmissão Online / Live', 'Projeção de Letras / EasyWorship', 'Câmera Principal', 'Fotografia'],
      color: '#F7B13D' // AD Brasil Gold
    },
    {
      id: 'min-recepcao',
      name: 'Recepção & Boas-Vindas',
      locais: ['Entrada Principal - Porta A', 'Entrada Principal - Porta B', 'Distribuição de Boletins', 'Acolhimento de Visitantes', 'Estacionamento'],
      color: '#1B7A32' // Deep Green
    },
    {
      id: 'min-infantil',
      name: 'Ministério Infantil',
      locais: ['Berçário (0 a 2 anos)', 'Maternal (3 a 5 anos)', 'Juniores (6 a 10 anos)', 'Apoio e Lanche'],
      color: '#E88A1A' // Amber
    },
    {
      id: 'min-diaconato',
      name: 'Diaconato & Apoio',
      locais: ['Recolhimento de Ofertas', 'Segurança Interna', 'Apoio ao Altar e Santa Ceia', 'Água e Conforto Pastoral'],
      color: '#134E24' // Forest Green
    }
  ];

  const services: Service[] = [
    { id: 'srv-dom-manha', label: 'Culto de Domingo Manhã (10h)', dayOfWeek: 'Domingo', time: '10:00' },
    { id: 'srv-dom-noite', label: 'Culto de Domingo Noite (19h)', dayOfWeek: 'Domingo', time: '19:00' },
    { id: 'srv-quarta', label: 'Quarta da Vitória & Oração (20h)', dayOfWeek: 'Quarta-feira', time: '20:00' },
    { id: 'srv-sabado-jovens', label: 'Culto de Jovens Conectados (19h30)', dayOfWeek: 'Sábado', time: '19:30' }
  ];

  const members: Member[] = [
    {
      id: 'mem-1',
      name: 'Pr. Lucas Ribeiro',
      cargo: 'Pastor Titular & Voz Líder',
      phone: '5511988881001',
      ministryId: 'min-louvor',
      locais: ['Voz Líder', 'Violão Acústico'],
      email: 'lucas.pastor@igreja.com.br'
    },
    {
      id: 'mem-2',
      name: 'Camila Fernandes',
      cargo: 'Líder de Louvor & Voz',
      phone: '5511988881002',
      ministryId: 'min-louvor',
      locais: ['Voz Líder', 'Backing Vocal 1'],
      email: 'camila.louvor@igreja.com.br'
    },
    {
      id: 'mem-3',
      name: 'Gabriel Siqueira',
      cargo: 'Músico (Baterista)',
      phone: '5511988881003',
      ministryId: 'min-louvor',
      locais: ['Bateria'],
      email: 'gabriel.drum@igreja.com.br'
    },
    {
      id: 'mem-4',
      name: 'Matheus Costa',
      cargo: 'Músico (Tecladista)',
      phone: '5511988881004',
      ministryId: 'min-louvor',
      locais: ['Teclado / Piano'],
      email: 'matheus.keys@igreja.com.br'
    },
    {
      id: 'mem-5',
      name: 'Felipe Alencar',
      cargo: 'Músico (Baixista)',
      phone: '5511988881005',
      ministryId: 'min-louvor',
      locais: ['Baixo Elétrico'],
      email: 'felipe.bass@igreja.com.br'
    },
    {
      id: 'mem-6',
      name: 'Beatriz Lima',
      cargo: 'Líder de Mídia',
      phone: '5511988882001',
      ministryId: 'min-midia',
      locais: ['Transmissão Online / Live', 'Projeção de Letras / EasyWorship'],
      email: 'beatriz.midia@igreja.com.br'
    },
    {
      id: 'mem-7',
      name: 'Rodrigo Macedo',
      cargo: 'Técnico de Áudio',
      phone: '5511988882002',
      ministryId: 'min-midia',
      locais: ['Mesa de Som (FOH)'],
      email: 'rodrigo.audio@igreja.com.br'
    },
    {
      id: 'mem-8',
      name: 'Juliana Barbosa',
      cargo: 'Líder de Recepção',
      phone: '5511988883001',
      ministryId: 'min-recepcao',
      locais: ['Entrada Principal - Porta A', 'Acolhimento de Visitantes'],
      email: 'juliana.recepcao@igreja.com.br'
    },
    {
      id: 'mem-9',
      name: 'Marcos Vinicius',
      cargo: 'Voluntário de Recepção',
      phone: '5511988883002',
      ministryId: 'min-recepcao',
      locais: ['Entrada Principal - Porta B', 'Estacionamento'],
      email: 'marcos.recepcao@igreja.com.br'
    },
    {
      id: 'mem-10',
      name: 'Tia Débora Santos',
      cargo: 'Coordenadora Infantil',
      phone: '5511988884001',
      ministryId: 'min-infantil',
      locais: ['Juniores (6 a 10 anos)', 'Berçário (0 a 2 anos)'],
      email: 'debora.kids@igreja.com.br'
    },
    {
      id: 'mem-11',
      name: 'Diácono Paulo Andrade',
      cargo: 'Diácono Chefe',
      phone: '5511988885001',
      ministryId: 'min-diaconato',
      locais: ['Apoio ao Altar e Santa Ceia', 'Recolhimento de Ofertas'],
      email: 'paulo.diacono@igreja.com.br'
    }
  ];

  const toLocalIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  const nextSundayIso = toLocalIso(nextSunday);

  const prevSunday = new Date(nextSunday);
  prevSunday.setDate(nextSunday.getDate() - 7);
  const prevSundayIso = toLocalIso(prevSunday);

  const wednesday = new Date(nextSunday);
  wednesday.setDate(nextSunday.getDate() - 4);
  const wednesdayIso = toLocalIso(wednesday);

  const saturday = new Date(nextSunday);
  saturday.setDate(nextSunday.getDate() - 1);
  const saturdayIso = toLocalIso(saturday);

  const schedules: Schedule[] = [
    {
      id: 'sch-proximo-domingo-noite',
      dateIso: nextSundayIso,
      serviceId: 'srv-dom-noite',
      serviceLabel: 'Culto de Domingo Noite (19h)',
      assignments: {
        'min-louvor': [
          { id: 'as-1', memberId: 'mem-2', local: 'Voz Líder', present: true },
          { id: 'as-2', memberId: 'mem-4', local: 'Teclado / Piano', present: true },
          { id: 'as-3', memberId: 'mem-3', local: 'Bateria', present: true },
          { id: 'as-4', memberId: 'mem-5', local: 'Baixo Elétrico', present: false }
        ],
        'min-midia': [
          { id: 'as-5', memberId: 'mem-7', local: 'Mesa de Som (FOH)', present: true },
          { id: 'as-6', memberId: 'mem-6', local: 'Projeção de Letras / EasyWorship', present: true }
        ],
        'min-recepcao': [
          { id: 'as-7', memberId: 'mem-8', local: 'Entrada Principal - Porta A', present: true },
          { id: 'as-8', memberId: 'mem-9', local: 'Entrada Principal - Porta B', present: true }
        ],
        'min-infantil': [
          { id: 'as-9', memberId: 'mem-10', local: 'Juniores (6 a 10 anos)', present: true }
        ],
        'min-diaconato': [
          { id: 'as-10', memberId: 'mem-11', local: 'Apoio ao Altar e Santa Ceia', present: true }
        ]
      },
      note: 'Reunião de oração com todos os voluntários às 18h15 na sala dos fundos. Uniforme: Camiseta preta ministerial.',
      createdAt: Date.now() - 86400000
    },
    {
      id: 'sch-sabado-jovens',
      dateIso: saturdayIso,
      serviceId: 'srv-sabado-jovens',
      serviceLabel: 'Culto de Jovens Conectados (19h30)',
      assignments: {
        'min-louvor': [
          { id: 'as-15', memberId: 'mem-2', local: 'Voz Líder', present: true },
          { id: 'as-16', memberId: 'mem-3', local: 'Bateria', present: false },
          { id: 'as-17', memberId: 'mem-5', local: 'Baixo Elétrico', present: true }
        ],
        'min-midia': [
          { id: 'as-18', memberId: 'mem-6', local: 'Transmissão Online / Live', present: true }
        ],
        'min-recepcao': [
          { id: 'as-19', memberId: 'mem-9', local: 'Acolhimento de Visitantes', present: true }
        ]
      },
      note: 'Passagem de som da banda jovem às 18h00.',
      createdAt: Date.now() - 2 * 86400000
    },
    {
      id: 'sch-quarta-vitoria',
      dateIso: wednesdayIso,
      serviceId: 'srv-quarta',
      serviceLabel: 'Quarta da Vitória & Oração (20h)',
      assignments: {
        'min-louvor': [
          { id: 'as-20', memberId: 'mem-1', local: 'Violão Acústico', present: true },
          { id: 'as-21', memberId: 'mem-4', local: 'Teclado / Piano', present: true }
        ],
        'min-midia': [
          { id: 'as-22', memberId: 'mem-7', local: 'Mesa de Som (FOH)', present: true }
        ],
        'min-diaconato': [
          { id: 'as-23', memberId: 'mem-11', local: 'Recolhimento de Ofertas', present: true }
        ]
      },
      note: 'Culto de ensino e clamor pelas famílias.',
      createdAt: Date.now() - 4 * 86400000
    },
    {
      id: 'sch-domingo-anterior',
      dateIso: prevSundayIso,
      serviceId: 'srv-dom-manha',
      serviceLabel: 'Culto de Domingo Manhã (10h)',
      assignments: {
        'min-louvor': [
          { id: 'as-11', memberId: 'mem-1', local: 'Voz Líder', present: true },
          { id: 'as-12', memberId: 'mem-4', local: 'Teclado / Piano', present: true }
        ],
        'min-midia': [
          { id: 'as-13', memberId: 'mem-7', local: 'Mesa de Som (FOH)', present: true }
        ],
        'min-recepcao': [
          { id: 'as-14', memberId: 'mem-8', local: 'Acolhimento de Visitantes', present: true }
        ]
      },
      note: 'Culto da Santa Ceia do Senhor. Todos os diáconos a postos para o serviço do pão e do cálice.',
      createdAt: Date.now() - 7 * 86400000
    }
  ];

  return { ministries, members, services, schedules };
}
