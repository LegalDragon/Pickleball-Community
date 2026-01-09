import { Link } from 'react-router-dom';
import { MapPin, Users, Award, Calendar, UserPlus, Star } from 'lucide-react';

const Features = () => {
  const features = [
    {
      icon: MapPin,
      title: 'Find Courts',
      description: 'Discover pickleball courts near you with photos, reviews, and real-time availability from the community.',
      link: '/courts',
      color: 'green'
    },
    {
      icon: Users,
      title: 'Join Clubs',
      description: 'Connect with local clubs, manage memberships, and stay updated on club events and announcements.',
      link: '/clubs',
      color: 'blue'
    },
    {
      icon: Award,
      title: 'Get Certified',
      description: 'Receive peer-reviewed skill ratings from players who know your game. Build your credibility.',
      link: '/my-certificate',
      color: 'purple'
    },
    {
      icon: Calendar,
      title: 'Discover Events',
      description: 'Find tournaments, social mixers, and open play sessions happening in your area.',
      link: '/events',
      color: 'orange'
    },
    {
      icon: UserPlus,
      title: 'Make Friends',
      description: 'Connect with players at your skill level, schedule games, and grow your pickleball network.',
      link: '/friends',
      color: 'pink'
    },
    {
      icon: Star,
      title: 'Rate & Review',
      description: 'Share your experiences at courts and events. Help the community find the best places to play.',
      link: '/courts',
      color: 'yellow'
    }
  ];

  const colorClasses = {
    green: 'bg-green-100 text-green-600 group-hover:bg-green-200',
    blue: 'bg-blue-100 text-blue-600 group-hover:bg-blue-200',
    purple: 'bg-purple-100 text-purple-600 group-hover:bg-purple-200',
    orange: 'bg-orange-100 text-orange-600 group-hover:bg-orange-200',
    pink: 'bg-pink-100 text-pink-600 group-hover:bg-pink-200',
    yellow: 'bg-yellow-100 text-yellow-600 group-hover:bg-yellow-200'
  };

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Play More Pickleball
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            One platform for finding courts, joining clubs, making friends, and growing your game
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Link
              key={index}
              to={feature.link}
              className="group bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-green-200"
            >
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl mb-6 transition-colors ${colorClasses[feature.color]}`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
