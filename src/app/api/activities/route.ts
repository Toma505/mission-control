import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const metrics = {
      activeAgents: { value: '3', subtitle: '2 idle' },
      tasksComplete: { value: '24', subtitle: '6 pending' },
      uptime: { value: '99.8%', subtitle: 'Last 30 days' },
      apiCalls: { value: '1.2k', subtitle: 'Today' },
    }

    const activities = [
      { 
        id: '1', 
        type: 'agent', 
        title: 'Research Complete', 
        description: 'Market analysis finished', 
        status: 'COMPLETED', 
        timestamp: new Date(Date.now() - 300000).toISOString() 
      },
      { 
        id: '2', 
        type: 'project', 
        title: 'Build Running', 
        description: 'Frontend compilation in progress', 
        status: 'IN_PROGRESS', 
        timestamp: new Date(Date.now() - 120000).toISOString() 
      },
      { 
        id: '3', 
        type: 'task', 
        title: 'Code Review', 
        description: 'PR #42 awaiting review', 
        status: 'PENDING', 
        timestamp: new Date(Date.now() - 600000).toISOString() 
      },
    ]

    const commits = [
      { 
        id: '1', 
        message: 'Add dashboard components', 
        author: 'Agent', 
        timestamp: new Date(Date.now() - 1800000).toISOString() 
      },
      { 
        id: '2', 
        message: 'Update layout structure', 
        author: 'Agent', 
        timestamp: new Date(Date.now() - 3600000).toISOString() 
      },
      { 
        id: '3', 
        message: 'Initial project setup', 
        author: 'Agent', 
        timestamp: new Date(Date.now() - 7200000).toISOString() 
      },
    ]

    return NextResponse.json({ metrics, activities, commits })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
