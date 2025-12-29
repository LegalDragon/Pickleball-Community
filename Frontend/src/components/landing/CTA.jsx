import React from 'react';
import { Link } from 'react-router-dom';

const CTA = () => {
  return (
    <section className="cta">
      <div className="container">
        <h2>Ready to Transform Your Game?</h2>
        <p>Join thousands of players who have improved their skills with Pickleball.College</p>
        <Link to="/Marketplace" className="btn btn-primary">Browse Courses</Link>
      </div>
    </section>
  );
};

export default CTA;
