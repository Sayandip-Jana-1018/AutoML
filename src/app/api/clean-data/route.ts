import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Read CSV content
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length < 2) {
            return NextResponse.json({ error: 'File is empty or invalid' }, { status: 400 })
        }

        // Get sample (header + first 100 rows)
        const sample = lines.slice(0, Math.min(101, lines.length)).join('\n')

        // Analyze with OpenAI
        const { text: analysis } = await generateText({
            model: openai('gpt-4-turbo'),
            prompt: `You are a data cleaning expert. Analyze this CSV dataset and provide cleaning recommendations in JSON format.

Dataset sample:
${sample}

Provide a JSON response with this structure:
{
  "issues": [
    {
      "type": "missing_values" | "duplicates" | "outliers" | "invalid_types" | "irrelevant_columns",
      "column": "column_name",
      "description": "Brief description",
      "severity": "high" | "medium" | "low"
    }
  ],
  "recommendations": {
    "drop_columns": ["column1", "column2"],
    "fill_missing": {
      "column_name": "mean" | "median" | "mode" | "forward_fill" | "drop"
    },
    "remove_duplicates": true | false,
    "handle_outliers": {
      "column_name": "cap" | "remove" | "keep"
    }
  },
  "summary": "Brief summary of data quality"
}

Be concise and only include actual issues found.`,
        })

        // Parse AI response
        let cleaningPlan
        try {
            // Extract JSON from response (AI might wrap it in markdown)
            const jsonMatch = analysis.match(/\{[\s\S]*\}/)
            cleaningPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysis)
        } catch (e) {
            console.error('Failed to parse AI response:', analysis)
            return NextResponse.json({
                error: 'Failed to analyze data',
                rawResponse: analysis
            }, { status: 500 })
        }

        // Apply cleaning recommendations
        const cleaned = applyCleaningPlan(lines, cleaningPlan)

        return NextResponse.json({
            original_rows: lines.length - 1,
            cleaned_rows: cleaned.length - 1,
            issues: cleaningPlan.issues || [],
            recommendations: cleaningPlan.recommendations || {},
            summary: cleaningPlan.summary || 'Data analyzed',
            cleaned_data: cleaned.join('\n')
        })

    } catch (error: any) {
        console.error('Data cleaning error:', error)
        return NextResponse.json({
            error: 'Data cleaning failed',
            details: error.message
        }, { status: 500 })
    }
}

function applyCleaningPlan(lines: string[], plan: any): string[] {
    const header = lines[0].split(',').map(h => h.trim())
    let rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()))

    // Remove duplicates
    if (plan.recommendations?.remove_duplicates) {
        const seen = new Set()
        rows = rows.filter(row => {
            const key = row.join('|')
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }

    // Drop columns
    const dropColumns = plan.recommendations?.drop_columns || []
    const keepIndices = header
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => !dropColumns.includes(h))
        .map(({ i }) => i)

    const newHeader = keepIndices.map(i => header[i])
    rows = rows.map(row => keepIndices.map(i => row[i]))

    // Fill missing values
    const fillMissing = plan.recommendations?.fill_missing || {}
    Object.entries(fillMissing).forEach(([colName, strategy]) => {
        const colIndex = newHeader.indexOf(colName)
        if (colIndex === -1) return

        const values = rows.map(row => row[colIndex]).filter(v => v && v !== '')

        if (strategy === 'mean' || strategy === 'median') {
            const nums = values.map(Number).filter(n => !isNaN(n))
            if (nums.length === 0) return

            const fillValue = strategy === 'mean'
                ? (nums.reduce((a, b) => a + b, 0) / nums.length).toString()
                : nums.sort((a, b) => a - b)[Math.floor(nums.length / 2)].toString()

            rows.forEach(row => {
                if (!row[colIndex] || row[colIndex] === '') {
                    row[colIndex] = fillValue
                }
            })
        } else if (strategy === 'mode') {
            const counts: Record<string, number> = {}
            values.forEach(v => counts[v] = (counts[v] || 0) + 1)
            const mode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]

            if (mode) {
                rows.forEach(row => {
                    if (!row[colIndex] || row[colIndex] === '') {
                        row[colIndex] = mode
                    }
                })
            }
        } else if (strategy === 'drop') {
            rows = rows.filter(row => row[colIndex] && row[colIndex] !== '')
        }
    })

    // Reconstruct CSV
    return [newHeader.join(','), ...rows.map(row => row.join(','))]
}
