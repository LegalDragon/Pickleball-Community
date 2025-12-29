import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <h1>Play Better Pickleball Now</h1>
          <p className="subtitle">
            Join the premier platform for pickleball education. Access world-class training materials,
            schedule sessions with certified coaches, and transform your game.
          </p>
          <div className="btn-group">
            <Link to="/Marketplace" className="btn btn-primary">Browse Courses</Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
