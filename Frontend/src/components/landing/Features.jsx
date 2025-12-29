import React from 'react';

const Features = () => {
  const features = [
    {
      icon: 'fas fa-user-graduate',
      title: 'Expert Coaching',
      description: 'Learn from certified pickleball coaches with years of professional experience'
    },
    {
      icon: 'fas fa-video',
      title: 'Video Training',
      description: 'Access high-quality video lessons and tutorials anytime, anywhere'
    },
    {
      icon: 'fas fa-book-open',
      title: 'Comprehensive Materials',
      description: 'Dive into our extensive library of training guides, drills, and strategy documents'
    }
  ];

  return (
    <section className="features">
      <div className="container">
        <div className="section-title">
          <h2>Why Choose Pickleball.College?</h2>
          <p>Everything you need to improve your pickleball skills, all in one modern platform</p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">
                <i className={feature.icon}></i>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;