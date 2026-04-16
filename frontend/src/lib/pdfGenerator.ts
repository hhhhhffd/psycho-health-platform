/**
 * PDF отчёт — генерация PDF с результатами тестов пользователя.
 * Использует html2canvas для захвата DOM элементов и jsPDF для компоновки PDF.
 * Вызывается из PsychDashboard по кнопке "Экспорт PDF".
 */
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/** Данные для генерации PDF отчёта */
export interface PDFReportData {
  userName: string
  userEmail: string
  ageGroup: string
  role: string
  testResults: {
    category: string
    score: number
    conditionLevel: string
    date: string
  }[]
  recommendations: string[]
  chartElementId?: string // ID DOM-элемента с графиком для захвата
}

/**
 * Генерирует PDF отчёт с данными аналитики.
 * Захватывает графики из DOM через html2canvas и компонует в jsPDF.
 */
export async function generatePDFReport(data: PDFReportData): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let y = 20

  // ── Заголовок ─────────────────────────────────────────────────
  doc.setFontSize(20)
  doc.setTextColor(99, 102, 241) // Indigo
  doc.text('PsyPlatform', margin, y)
  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(new Date().toLocaleDateString(), pageWidth - margin, y, { align: 'right' })
  y += 10

  // Линия-разделитель
  doc.setDrawColor(99, 102, 241)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  // ── Информация о пользователе ─────────────────────────────────
  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text('User Report', margin, y)
  y += 8

  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  const userInfo = [
    `Name: ${data.userName}`,
    `Email: ${data.userEmail}`,
    `Age Group: ${data.ageGroup}`,
    `Role: ${data.role}`,
  ]
  for (const line of userInfo) {
    doc.text(line, margin, y)
    y += 6
  }
  y += 5

  // ── Захват графика из DOM (если указан) ────────────────────────
  if (data.chartElementId) {
    const chartEl = document.getElementById(data.chartElementId)
    if (chartEl) {
      try {
        const canvas = await html2canvas(chartEl, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
        })
        const imgData = canvas.toDataURL('image/png')
        const imgWidth = pageWidth - margin * 2
        const imgHeight = (canvas.height / canvas.width) * imgWidth

        // Если график не помещается на текущей странице — добавляем новую
        if (y + imgHeight > 270) {
          doc.addPage()
          y = 20
        }

        doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
        y += imgHeight + 10
      } catch (err) {
        console.error('Chart capture failed:', err)
      }
    }
  }

  // ── Таблица результатов тестов ──────────────────────────────────
  if (y > 230) {
    doc.addPage()
    y = 20
  }

  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text('Test Results', margin, y)
  y += 8

  // Заголовки таблицы
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  const colWidths = [50, 25, 50, 40]
  const headers = ['Category', 'Score', 'Level', 'Date']
  headers.forEach((h, i) => {
    const x = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
    doc.text(h, x, y)
  })
  y += 2
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  // Строки данных
  doc.setTextColor(60, 60, 60)
  const levelColors: Record<string, [number, number, number]> = {
    normal: [34, 197, 94],
    elevated_stress: [234, 179, 8],
    burnout_risk: [249, 115, 22],
    critical: [239, 68, 68],
  }

  for (const result of data.testResults) {
    if (y > 270) {
      doc.addPage()
      y = 20
    }

    const cols = [result.category, String(result.score), result.conditionLevel, result.date]
    cols.forEach((val, i) => {
      const x = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
      // Цветной текст для уровня
      if (i === 2) {
        const color = levelColors[result.conditionLevel] ?? [60, 60, 60]
        doc.setTextColor(color[0], color[1], color[2])
      } else {
        doc.setTextColor(60, 60, 60)
      }
      doc.text(val, x, y)
    })
    y += 6
  }
  y += 5

  // ── Рекомендации ───────────────────────────────────────────────
  if (data.recommendations.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = 20
    }

    doc.setFontSize(14)
    doc.setTextColor(30, 30, 30)
    doc.text('Recommendations', margin, y)
    y += 8

    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    for (let i = 0; i < data.recommendations.length; i++) {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      const text = `${i + 1}. ${data.recommendations[i]}`
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2) as string[]
      for (const line of lines) {
        doc.text(line, margin, y)
        y += 5
      }
      y += 2
    }
  }

  // ── Футер ──────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Generated by PsyPlatform | Page ${i}/${pageCount}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    )
  }

  // Скачиваем файл
  const filename = `report_${data.userName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
