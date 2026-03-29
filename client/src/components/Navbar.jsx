import { Link, useLocation } from "react-router-dom";
import { useStore } from "../store/useStore";
import {
  LayoutGrid,
  Vote,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import Button from "./Button";

export default function Navbar() {
  const user = useStore((state) => state.user);
  const memberData = useStore((state) => state.memberData);
  const signOut = useStore((state) => state.signOut);
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { name: "Voting Hub", href: "/voting", icon: Vote },
    { name: "Standings", href: "/results", icon: BarChart3 },
  ].filter((item) => {
    if (memberData?.is_admin && item.name === "Voting Hub") return false;
    return true;
  });

  if (memberData?.is_admin) {
    navigation.push({ name: "Admin Panel", href: "/admin", icon: Shield });
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/dashboard" className="flex items-center gap-4 group">
            <div className="w-14 h-14 bg-white/50 backdrop-blur-sm rounded-2xl flex items-center justify-center p-0 shadow-sm border border-slate-50 transition-all group-hover:shadow-md group-hover:scale-105 overflow-visible">
              <img
                src={`${import.meta.env.BASE_URL}bwt.png`}
                alt="BWT Logo"
                className="w-full h-full object-contain transform scale-[1.25] brightness-[1.05] contrast-[1.05]"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                BWT
              </span>
              <span className="text-[8px] font-black text-blue-600 uppercase tracking-[0.3em] leading-none mt-1">
                Protocol
              </span>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-50">
                Version: v2.0
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    isActive
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-100"
                      : "text-slate-400 hover:text-slate-900 hover:bg-slate-50",
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}

            <div className="w-px h-6 bg-slate-100 mx-4" />

            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-red-600 font-black uppercase tracking-widest text-[10px] transition-all"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>

          <div className="md:hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              icon={isOpen ? X : Menu}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-50 bg-white overflow-hidden shadow-2xl"
          >
            <div className="p-4 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl text-xs font-black uppercase tracking-widest",
                    location.pathname === item.href
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 bg-slate-50",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}
              <button
                onClick={() => {
                  setIsOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-red-600 bg-red-50"
              >
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
