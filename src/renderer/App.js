import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.scss';
import { useState, useEffect } from 'react';
import Spinner from './components/Spinner';
import PlayerCard from './components/PlayerCard';
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
    }, 15_000)
    return () => clearInterval(loop)
  }, [])

  useEffect(() => {
    console.log(match)
  }, [match])

  window.bridge.getUser((event, lf) => {
    setUser(lf)
    window.bridge.awaitDeath()
  })

  window.bridge.getMatch((event, m) => {
    console.log(m)
    setMatch(_ => m)
  })

  return user ? match?.error === 'No Live Game' ? (
    <PlayerCard user={user} width={'500px'} />
  ) : (
    <Match match={match} />
  ) : (
    <Spinner text={"Waiting for Valorant..."} />
  )
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
