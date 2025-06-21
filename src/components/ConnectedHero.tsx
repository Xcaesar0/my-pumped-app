import React, { useState } from 'react'
import { Trophy, Target, Users, Star } from 'lucide-react'
import { User } from '../lib/supabase'
import TasksMenu from './TasksMenu'
import LeaderboardMenu from './LeaderboardMenu'
import BountyHunterDashboard from './BountyHunterDashboard'

interface ConnectedHeroProps {
  user: User
}

const ConnectedHero: React.FC<ConnectedHeroProps> = ({ user }) => {
  // Show Bounty Hunter Dashboard by default
  return <BountyHunterDashboard user={user} />
}

export default ConnectedHero