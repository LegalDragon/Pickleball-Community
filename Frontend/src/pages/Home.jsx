import React from 'react';
import Header from '../components/landing/Header';
import RecentPlayers from '../components/landing/RecentPlayers';
import Stats from '../components/landing/Stats';
import Features from '../components/landing/Features';
import FeaturedEvents from '../components/landing/FeaturedEvents';
import VlogGallery from '../components/landing/VlogGallery';
import CTA from '../components/landing/CTA';
import Footer from '../components/landing/Footer';

const Home = () => {
  return (
    <div className="home-page">
      <Header />
      <RecentPlayers />
      <FeaturedEvents />
      <VlogGallery />
      <Stats />
      <Features />
      <CTA />
    </div>
  );
};

export default Home;