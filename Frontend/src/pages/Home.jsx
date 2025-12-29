import React from 'react';
import Header from '../components/landing/Header';
import Stats from '../components/landing/Stats';
import Features from '../components/landing/Features';
import CTA from '../components/landing/CTA';
import Footer from '../components/landing/Footer';

const Home = () => {
  return (
    <div className="home-page">
      <Header />
      <Stats />
      <Features />
      <CTA /> 
    </div>
  );
};

export default Home;