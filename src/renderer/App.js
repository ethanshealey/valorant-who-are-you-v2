import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.scss';
import { useState, useEffect } from 'react';
import Lockfile from 'models/Lockfile';
import Spinner from './components/Spinner';
import PlayerCard from './components/PlayerCard';
import sleep from '../helpers/sleep';
import Match from './components/Match';

const Main = () => {

  const [ user, setUser ] = useState()
  const [ match, setMatch ] = useState({ error: 'No Live Game' })

  useEffect(() => {
    window.bridge.requestUser()
  }, [])  

  useEffect(() => {
    const loop = setInterval(() => {
      window.bridge.requestMatch()
    }, 30_000)
    return () => clearInterval(loop)
  }, [match])

  window.bridge.getUser((event, lf) => {
    setUser(lf)
    console.log(lf)
    window.bridge.requestMatch()
    window.bridge.awaitDeath()
  })

  window.bridge.getMatch((event, m) => {
    setMatch(m)
    console.log(m)
  })

  return user ? match?.error === 'No Live Game' ? (
    <PlayerCard user={user} width={'500px'} />
  ) : (
    <Match match={match} />
  ) : (
    <Spinner text={"Loading..."} />
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Main />} />
      </Routes>
    </Router>
  );
}
