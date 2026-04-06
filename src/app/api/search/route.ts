import { NextRequest, NextResponse } from 'next/server'

import { readChangelogEntries } from '@/lib/changelog-store'
import { listKnowledgeBase } from '@/lib/knowledge-store'
import { filterPrompts, readPromptStore } from '@/lib/prompt-library-store'
import { listReplaySessions } from '@/lib/replay-store'
import { readSchedules } from '@/lib/schedules'
import { readTemplateStore } from '@/lib/agent-templates-store'

type SearchResult = {
  id: string
  title: string
  subtitle: string
  href: string
  score: number
}

type SearchGroup = {
  id: string
  label: string
  href: string
  total: number
  results: SearchResult[]
}

function queryTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
}

function scoreText(value: string, terms: string[], weight: number) {
  const text = value.toLowerCase()
  let score = 0

  for (const term of terms) {
    if (text === term) score += weight * 10
    else if (text.startsWith(term)) score += weight * 6
    else if (text.includes(term)) score += weight * 3
  }

  return score
}

function scoreFields(
  fields: Array<{ value: string | undefined; weight: number }>,
  terms: string[],
) {
  return fields.reduce((total, field) => total + scoreText(field.value || '', terms, field.weight), 0)
}

function buildGroup(
  id: string,
  label: string,
  href: string,
  results: SearchResult[],
): SearchGroup | null {
  if (results.length === 0) return null

  const sorted = results.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
  return {
    id,
    label,
    href,
    total: sorted.length,
    results: sorted,
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || ''
  if (!query) {
    return NextResponse.json({ query: '', groups: [] })
  }

  const terms = queryTerms(query)
  if (terms.length === 0) {
    return NextResponse.json({ query, groups: [] })
  }

  const [promptStore, templateStore, replaySessions, knowledgeBase, changelogStore, scheduleStore] =
    await Promise.all([
      readPromptStore(),
      readTemplateStore(),
      listReplaySessions(),
      listKnowledgeBase(),
      readChangelogEntries().then((entries) => ({ entries })),
      readSchedules(),
    ])

  const promptMatches = filterPrompts(promptStore.prompts, query, '', '')
    .map((prompt) => ({
      id: prompt.id,
      title: prompt.name,
      subtitle: `Prompt Library - ${prompt.category}`,
      href: `/prompts?prompt=${encodeURIComponent(prompt.id)}`,
      score: scoreFields(
        [
          { value: prompt.name, weight: 5 },
          { value: prompt.description, weight: 3 },
          { value: prompt.content, weight: 2 },
          { value: prompt.tags.join(' '), weight: 2 },
        ],
        terms,
      ),
    }))
    .filter((result) => result.score > 0)

  const templateMatches = templateStore.templates
    .map((template) => ({
      id: template.id,
      title: template.name,
      subtitle: `Agent Templates - ${template.description}`,
      href: `/templates?template=${encodeURIComponent(template.id)}`,
      score: scoreFields(
        [
          { value: template.name, weight: 5 },
          { value: template.description, weight: 3 },
          { value: template.systemPrompt, weight: 1 },
          { value: template.recommendedModel, weight: 2 },
        ],
        terms,
      ),
    }))
    .filter((result) => result.score > 0)

  const replayMatches = replaySessions
    .map((session) => ({
      id: session.id,
      title: session.taskDescription || session.sessionKey,
      subtitle: `Replay - ${session.agentId} on ${session.instanceId}`,
      href: `/replay?session=${encodeURIComponent(session.id)}`,
      score: scoreFields(
        [
          { value: session.taskDescription, weight: 5 },
          { value: session.agentId, weight: 4 },
          { value: session.sessionKey, weight: 3 },
          { value: session.model, weight: 2 },
        ],
        terms,
      ),
    }))
    .filter((result) => result.score > 0)

  const knowledgeMatches = knowledgeBase.files
    .map((file) => ({
      id: file.id,
      title: file.name,
      subtitle: `Knowledge Base - ${file.chunkCount} chunks`,
      href: `/knowledge?file=${encodeURIComponent(file.id)}`,
      score: scoreFields([{ value: file.name, weight: 5 }], terms),
    }))
    .filter((result) => result.score > 0)

  const changelogMatches = changelogStore.entries
    .map((entry) => ({
      id: entry.version,
      title: entry.version,
      subtitle: `Changelog - ${entry.date}`,
      href: `/changelog?version=${encodeURIComponent(entry.version)}`,
      score: scoreFields(
        [
          { value: entry.version, weight: 5 },
          { value: entry.changes.added.join(' '), weight: 2 },
          { value: entry.changes.improved.join(' '), weight: 2 },
          { value: entry.changes.fixed.join(' '), weight: 2 },
        ],
        terms,
      ),
    }))
    .filter((result) => result.score > 0)

  const scheduleMatches = scheduleStore.tasks
    .map((task) => ({
      id: task.id,
      title: task.name,
      subtitle: `Scheduled Tasks - ${task.cronExpression}`,
      href: `/schedules?task=${encodeURIComponent(task.id)}`,
      score: scoreFields([{ value: task.name, weight: 5 }], terms),
    }))
    .filter((result) => result.score > 0)

  const groups = [
    buildGroup('prompts', 'Prompts', `/prompts?q=${encodeURIComponent(query)}`, promptMatches),
    buildGroup('templates', 'Templates', `/templates?q=${encodeURIComponent(query)}`, templateMatches),
    buildGroup('replays', 'Sessions & Replays', `/replay?q=${encodeURIComponent(query)}`, replayMatches),
    buildGroup('knowledge', 'Knowledge Base', `/knowledge?q=${encodeURIComponent(query)}`, knowledgeMatches),
    buildGroup('changelog', 'Changelog', `/changelog?q=${encodeURIComponent(query)}`, changelogMatches),
    buildGroup('schedules', 'Scheduled Tasks', `/schedules?q=${encodeURIComponent(query)}`, scheduleMatches),
  ].filter((group): group is SearchGroup => group !== null)

  return NextResponse.json({ query, groups })
}
