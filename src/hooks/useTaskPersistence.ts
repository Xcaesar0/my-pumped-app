import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface TaskStatus {
  [taskId: string]: 'not_started' | 'in_progress' | 'verifying' | 'completed'
}

interface CompletedTask {
  id: string
  title: string
  platform: 'x' | 'telegram' | 'general'
  completedAt: string
}

export const useTaskPersistence = (userId: string | null) => {
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus>({})
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // Load task statuses from localStorage and database on mount
  useEffect(() => {
    const loadTaskData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Load from localStorage first for immediate UI response
        const localStatuses = JSON.parse(localStorage.getItem('taskStatuses') || '{}')
        const localCompleted = JSON.parse(localStorage.getItem('completedTasks') || '[]')
        
        setTaskStatuses(localStatuses)
        setCompletedTasks(localCompleted)

        // If user is logged in, sync with database
        if (userId) {
          await syncWithDatabase()
        }
      } catch (err) {
        console.error('Error loading task data:', err)
        setError('Failed to load task data')
      } finally {
        setLoading(false)
      }
    }

    loadTaskData()
    
    // Set up auto-sync interval (every 5 minutes)
    const autoSyncInterval = setInterval(() => {
      if (userId) {
        syncWithDatabase().catch(err => {
          console.warn('Auto-sync failed:', err)
        })
      }
    }, 5 * 60 * 1000)
    
    return () => clearInterval(autoSyncInterval)
  }, [userId])

  // Sync with database whenever userId changes
  useEffect(() => {
    if (userId) {
      syncWithDatabase()
    }
  }, [userId])

  // Sync local data with database
  const syncWithDatabase = async () => {
    if (!userId) return

    try {
      // Fetch completed tasks from database
      const [xCompletions, taskSubmissions] = await Promise.all([
        fetchXTaskCompletions(),
        fetchTaskSubmissions()
      ])

      // Merge database data with local data
      const mergedCompletedTasks = mergeCompletedTasks(xCompletions, taskSubmissions)
      
      // Update local storage with merged data
      localStorage.setItem('completedTasks', JSON.stringify(mergedCompletedTasks))
      setCompletedTasks(mergedCompletedTasks)
      
      // Update task statuses based on completed tasks
      const updatedStatuses = { ...taskStatuses }
      mergedCompletedTasks.forEach(task => {
        updatedStatuses[task.id] = 'completed'
      })
      
      localStorage.setItem('taskStatuses', JSON.stringify(updatedStatuses))
      setTaskStatuses(updatedStatuses)
      
      setLastSyncTime(new Date())
      return true
    } catch (err) {
      console.error('Error syncing with database:', err)
      setError('Failed to sync with database')
      return false
    }
  }

  // Fetch X task completions from database
  const fetchXTaskCompletions = async (): Promise<CompletedTask[]> => {
    if (!userId) return []

    try {
      const { data, error } = await supabase
        .from('x_task_completions')
        .select('task_title, completed_at')
        .eq('user_id', userId)

      if (error) throw error

      return (data || []).map(item => ({
        id: getTaskIdFromTitle(item.task_title),
        title: item.task_title,
        platform: 'x',
        completedAt: item.completed_at
      }))
    } catch (err) {
      console.warn('Error fetching X task completions:', err)
      return []
    }
  }

  // Fetch task submissions from database
  const fetchTaskSubmissions = async (): Promise<CompletedTask[]> => {
    if (!userId) return []

    try {
      const { data, error } = await supabase
        .from('user_task_submissions')
        .select('admin_task_id, status, reviewed_at, admin_tasks(title, platform)')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .not('admin_tasks', 'is', null)

      if (error) throw error

      return (data || []).map(item => ({
        id: getTaskIdFromTitle(item.admin_tasks.title),
        title: item.admin_tasks.title,
        platform: item.admin_tasks.platform,
        completedAt: item.reviewed_at
      }))
    } catch (err) {
      console.warn('Error fetching task submissions:', err)
      return []
    }
  }

  // Merge completed tasks from different sources
  const mergeCompletedTasks = (
    xCompletions: CompletedTask[],
    taskSubmissions: CompletedTask[]
  ): CompletedTask[] => {
    const localCompleted = JSON.parse(localStorage.getItem('completedTasks') || '[]')
    
    // Create a map of task IDs to tasks
    const tasksMap = new Map<string, CompletedTask>()
    
    // Add local tasks first
    localCompleted.forEach((task: CompletedTask) => {
      tasksMap.set(task.id, task)
    })
    
    // Add X completions, overriding local if exists
    xCompletions.forEach(task => {
      tasksMap.set(task.id, task)
    })
    
    // Add task submissions, overriding previous if exists
    taskSubmissions.forEach(task => {
      tasksMap.set(task.id, task)
    })
    
    return Array.from(tasksMap.values())
  }

  // Get task ID from title
  const getTaskIdFromTitle = (title: string): string => {
    switch (title) {
      case 'Join Telegram':
        return 'join_telegram'
      case 'Follow @pumpeddotfun':
        return 'follow_x'
      case 'Repost Launch Post':
        return 'repost_launch'
      default:
        return title.toLowerCase().replace(/\s+/g, '_')
    }
  }

  // Update task status
  const updateTaskStatus = async (
    taskId: string, 
    status: 'not_started' | 'in_progress' | 'verifying' | 'completed'
  ) => {
    try {
      // Update local state
      const updatedStatuses = { ...taskStatuses, [taskId]: status }
      setTaskStatuses(updatedStatuses)
      
      // Save to localStorage
      localStorage.setItem('taskStatuses', JSON.stringify(updatedStatuses))
      
      // If task is completed, add to completed tasks
      if (status === 'completed') {
        const newCompletedTask: CompletedTask = {
          id: taskId,
          title: getTaskTitleFromId(taskId),
          platform: getTaskPlatformFromId(taskId),
          completedAt: new Date().toISOString()
        }
        
        const updatedCompletedTasks = [...completedTasks, newCompletedTask]
        setCompletedTasks(updatedCompletedTasks)
        localStorage.setItem('completedTasks', JSON.stringify(updatedCompletedTasks))
      }
      
      return true
    } catch (err) {
      console.error('Error updating task status:', err)
      setError('Failed to update task status')
      return false
    }
  }

  // Get task title from ID
  const getTaskTitleFromId = (id: string): string => {
    switch (id) {
      case 'join_telegram':
        return 'Join Telegram'
      case 'follow_x':
        return 'Follow @pumpeddotfun'
      case 'repost_launch':
        return 'Repost Launch Post'
      default:
        return id.replace(/_/g, ' ')
    }
  }

  // Get task platform from ID
  const getTaskPlatformFromId = (id: string): 'x' | 'telegram' | 'general' => {
    if (id.includes('telegram')) return 'telegram'
    if (id.includes('x') || id.includes('repost') || id.includes('follow')) return 'x'
    return 'general'
  }

  // Check if task is completed
  const isTaskCompleted = (taskId: string): boolean => {
    return taskStatuses[taskId] === 'completed' || 
           completedTasks.some(task => task.id === taskId)
  }

  // Get task status
  const getTaskStatus = (taskId: string): 'not_started' | 'in_progress' | 'verifying' | 'completed' => {
    if (isTaskCompleted(taskId)) return 'completed'
    return taskStatuses[taskId] || 'not_started'
  }

  // Mark task as completed in database
  const markTaskCompleted = async (
    taskId: string, 
    taskTitle: string, 
    xUsername?: string
  ): Promise<{ success: boolean; message?: string; points?: number }> => {
    if (!userId) {
      return { success: false, message: 'User not logged in' }
    }

    try {
      setError(null)
      
      // Update local status to verifying
      await updateTaskStatus(taskId, 'verifying')
      
      // Call the database function to record completion
      const { data, error } = await supabase.rpc('process_x_task_completion', {
        task_title_param: taskTitle,
        user_id_param: userId,
        x_username_param: xUsername || 'unknown'
      })

      if (error) {
        console.error('Error marking task as completed:', error)
        await updateTaskStatus(taskId, 'in_progress') // Revert to in_progress
        return { success: false, message: 'Failed to complete task: ' + error.message }
      }

      if (data.success) {
        // Update local status to completed
        await updateTaskStatus(taskId, 'completed')
        
        // Trigger a sync to ensure database and local storage are in sync
        await syncWithDatabase()
        
        return { 
          success: true, 
          message: data.message || 'Task completed successfully!',
          points: data.points_awarded
        }
      } else {
        await updateTaskStatus(taskId, 'in_progress') // Revert to in_progress
        return { 
          success: false, 
          message: data.error || 'Failed to complete task' 
        }
      }
    } catch (err) {
      console.error('Error marking task as completed:', err)
      await updateTaskStatus(taskId, 'in_progress') // Revert to in_progress
      setError('Failed to complete task')
      return { success: false, message: 'An unexpected error occurred' }
    }
  }

  return {
    taskStatuses,
    completedTasks,
    loading,
    error,
    lastSyncTime,
    updateTaskStatus,
    isTaskCompleted,
    getTaskStatus,
    markTaskCompleted,
    syncWithDatabase
  }
}