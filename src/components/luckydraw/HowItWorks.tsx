import { UserPlus, Ticket, Share2, Trophy } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: UserPlus,
    title: "Sign Up Free",
    description: "Create your account and get 1 free entry instantly for every active draw.",
  },
  {
    icon: Ticket,
    title: "Get More Entries",
    description: "Buy additional entries for just ₹1 each to increase your chances of winning.",
  },
  {
    icon: Share2,
    title: "Refer Friends",
    description: "Share your unique referral link. Each friend who joins = 1 bonus entry for you.",
  },
  {
    icon: Trophy,
    title: "Win Prizes",
    description: "Winners are selected transparently. Prizes are credited to your wallet instantly.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 md:py-20 bg-muted/50">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">How It Works</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">Four simple steps to start winning. No hidden catches.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-card rounded-xl p-6 shadow-sm border border-border text-center"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {i + 1}
              </div>
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4 mt-2">
                <step.icon className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
