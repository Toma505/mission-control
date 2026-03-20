import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data
  await prisma.activity.deleteMany()
  await prisma.task.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.commit.deleteMany()
  await prisma.document.deleteMany()
  await prisma.client.deleteMany()
  await prisma.cronJob.deleteMany()
  await prisma.systemStatus.deleteMany()

  // Create Agents
  const jarvis = await prisma.agent.create({
    data: {
      name: 'Jarvis',
      tagline: 'System Orchestration & Strategy',
      description: 'To provide Tristyn with ultimate leverage through autonomous intelligence',
      status: 'ACTIVE',
      capabilities: JSON.stringify([
        'Task coordination',
        'Strategic planning',
        'Resource allocation',
        'System monitoring'
      ])
    }
  })

  const architect = await prisma.agent.create({
    data: {
      name: 'The Architect',
      tagline: 'CORE INFRASTRUCTURE',
      description: 'To maintain a dynamic foundation and keep the proactive swarm',
      status: 'ACTIVE',
      capabilities: JSON.stringify([
        'Infrastructure design',
        'System architecture',
        'Performance optimization',
        'Technical foundation'
      ])
    }
  })

  const serviceRoster = await prisma.agent.create({
    data: {
      name: 'Service Roster',
      tagline: 'COMMANDER',
      description: 'Lead customers and orchestration of the teams. Blueprint for allocating skill-based....',
      status: 'IDLE',
      capabilities: JSON.stringify([
        'Team management',
        'Customer coordination',
        'Resource allocation'
      ])
    }
  })

  console.log('✅ Created agents')

  // Create Tasks
  const task1 = await prisma.task.create({
    data: {
      title: 'Client Business Tracking Status',
      description: 'Track high-level progress, organize client data, track business milestones, and streamline reporting, especially when used with CSV or...',
      status: 'IN_PROGRESS',
      progress: 80,
      priority: 'HIGH',
      tags: JSON.stringify(['Planning', 'Client Management']),
      assignedAgents: {
        connect: [{ id: jarvis.id }]
      }
    }
  })

  const task2 = await prisma.task.create({
    data: {
      title: 'NAS Backup Soli',
      description: 'Build a self-healing architecture using weekly sync, track backups, coordinate with services like Hetzner, and ensure reliable off-site data protection',
      status: 'IN_PROGRESS',
      progress: 65,
      priority: 'HIGH',
      tags: JSON.stringify(['Infrastructure', 'Backup']),
      assignedAgents: {
        connect: [{ id: architect.id }]
      }
    }
  })

  const task3 = await prisma.task.create({
    data: {
      title: 'Memory Building Skill',
      description: 'Build a well-organized directory with chat log links, notes, recommendations, and CSV data. Make it fully integrated with file systems and databases.',
      status: 'PLANNING',
      progress: 30,
      priority: 'MEDIUM',
      tags: JSON.stringify(['Development', 'Data']),
      assignedAgents: {
        connect: [{ id: jarvis.id }]
      }
    }
  })

  const task4 = await prisma.task.create({
    data: {
      title: 'Prevent Wails Build issue',
      description: 'Fix module issues or service crashes due to module clashes, remove problematic dependencies, and ensure system stability',
      status: 'BACKLOGGED',
      progress: 0,
      priority: 'LOW',
      tags: JSON.stringify(['Bug Fix', 'Development'])
    }
  })

  const task5 = await prisma.task.create({
    data: {
      title: 'Email Quick and Extension Tab to Open Dashboard App',
      description: 'Make inbox control intuitive, add shortcuts for accessing workspace, streamline user experience, and boost productivity.',
      status: 'COMPLETED',
      progress: 100,
      priority: 'MEDIUM',
      tags: JSON.stringify(['Feature', 'UI/UX']),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  })

  const task6 = await prisma.task.create({
    data: {
      title: 'Classify/Tagging/Prep Automation',
      description: 'Automate the classification, tagging, and preprocessing of files to improve organization and reduce manual effort.',
      status: 'IN_PROGRESS',
      progress: 45,
      priority: 'MEDIUM',
      tags: JSON.stringify(['Automation', 'Data']),
      assignedAgents: {
        connect: [{ id: jarvis.id }]
      }
    }
  })

  const task7 = await prisma.task.create({
    data: {
      title: 'Primary Virtual Control/Organization (Baseline)',
      description: 'Establish primary virtual control center for organizational structure, workflow management, and baseline operations tracking',
      status: 'ACTIVE',
      progress: 90,
      priority: 'HIGH',
      tags: JSON.stringify(['Core', 'Organization'])
    }
  })

  const task8 = await prisma.task.create({
    data: {
      title: 'Federal/State Policy and Organization (Baseline)',
      description: 'Build a comprehensive knowledge base for federal and state policies, ensure compliance tracking, and organize regulatory framework.',
      status: 'COMPLETED',
      progress: 100,
      priority: 'HIGH',
      tags: JSON.stringify(['Compliance', 'Policy']),
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    }
  })

  console.log('✅ Created tasks')

  // Create Activities
  await prisma.activity.create({
    data: {
      type: 'SYSTEM_EVENT',
      title: 'OK No System events',
      description: 'HEARTBEAT_OK No system events. 10:37 PM...',
      status: 'IN_PROGRESS',
      agentId: jarvis.id,
      timestamp: new Date(Date.now() - 6 * 60 * 1000)
    }
  })

  await prisma.activity.create({
    data: {
      type: 'TASK_UPDATE',
      title: 'In Progress',
      description: 'Executing read',
      status: 'IN_PROGRESS',
      taskId: task1.id,
      timestamp: new Date(Date.now() - 8 * 60 * 1000)
    }
  })

  await prisma.activity.create({
    data: {
      type: 'TASK_UPDATE',
      title: 'In Progress',
      description: 'Executing read',
      status: 'IN_PROGRESS',
      taskId: task2.id,
      timestamp: new Date(Date.now() - 8 * 60 * 1000)
    }
  })

  await prisma.activity.create({
    data: {
      type: 'POLICY_CHANGE',
      title: 'Meta Policy Change Monitor',
      description: 'Mission Control back online - reconfigured for new network 192.168.6.0...',
      status: 'COMPLETED',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
    }
  })

  await prisma.activity.create({
    data: {
      type: 'POLICY_CHANGE',
      title: 'Meta Policy Change Monitor',
      description: 'Meta Policy Change Monitor deployed and active',
      status: 'COMPLETED',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
    }
  })

  console.log('✅ Created activities')

  // Create Commits
  await prisma.commit.create({
    data: {
      message: 'feat(cataclysm): Transform Mission Control to Liquid Glass UI',
      author: 'Jarvis Main',
      timestamp: new Date(Date.now() - 10 * 60 * 1000)
    }
  })

  await prisma.commit.create({
    data: {
      message: 'refactor(deploy): Prepare for relocation - all tasks complete, clean disabled',
      author: 'Jarvis Main',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
    }
  })

  await prisma.commit.create({
    data: {
      message: 'enhancement: Move Dashboard above Journal in navigation',
      author: 'Jarvis Main',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
    }
  })

  await prisma.commit.create({
    data: {
      message: 'refactor(search): Make top stat cards equal height',
      author: 'Jarvis Main',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000)
    }
  })

  console.log('✅ Created commits')

  // Create Documents
  await prisma.document.create({
    data: {
      name: 'Mission_Control_Proposal.pdf',
      type: 'pdf',
      size: 2457600,
      path: '/documents/mission-control-proposal.pdf',
      uploadedBy: 'Jarvis',
      tags: JSON.stringify(['Proposal', 'Strategy'])
    }
  })

  await prisma.document.create({
    data: {
      name: 'System_Architecture_Diagram.png',
      type: 'png',
      size: 1024000,
      path: '/documents/architecture-diagram.png',
      uploadedBy: 'The Architect',
      tags: JSON.stringify(['Architecture', 'Diagram'])
    }
  })

  await prisma.document.create({
    data: {
      name: 'Client_Onboarding_Checklist.docx',
      type: 'docx',
      size: 102400,
      path: '/documents/client-onboarding.docx',
      uploadedBy: 'Service Roster',
      tags: JSON.stringify(['Client', 'Onboarding'])
    }
  })

  console.log('✅ Created documents')

  // Create Clients
  await prisma.client.create({
    data: {
      name: 'Acme Corporation',
      status: 'ACTIVE',
      lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }
  })

  await prisma.client.create({
    data: {
      name: 'TechStart Inc',
      status: 'ACTIVE',
      lastActivity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  })

  console.log('✅ Created clients')

  // Create Cron Jobs
  await prisma.cronJob.create({
    data: {
      name: 'Nightly Backup',
      schedule: '0 2 * * *',
      status: 'ACTIVE',
      lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000)
    }
  })

  await prisma.cronJob.create({
    data: {
      name: 'Weekly System Health Check',
      schedule: '0 9 * * 1',
      status: 'ACTIVE',
      lastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    }
  })

  console.log('✅ Created cron jobs')

  // Create System Status
  await prisma.systemStatus.create({
    data: {
      overall: 'ACTIVE',
      message: 'Ready and waiting for tasks',
      agentsActive: 2,
      tasksInProgress: 4,
      systemLoad: 0.34
    }
  })

  console.log('✅ Created system status')

  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
