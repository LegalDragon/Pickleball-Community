import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Users } from 'lucide-react';

const CTA = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-green-600 to-emerald-700">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          Ready to Join the Community?
        </h2>
        <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
          Find courts, connect with players, and take your game to the next level. It's free to get started.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/courts"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <MapPin className="w-5 h-5" />
            Find Courts Near You
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-400 transition-all border-2 border-white/30"
          >
            <Users className="w-5 h-5" />
            Create Free Account
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CTA;
