import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const SearchBar = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form 
      onSubmit={handleSearch}
      className="flex gap-2 max-w-2xl mx-auto glass-effect rounded-2xl p-3 border border-border/50 shadow-lg"
    >
      <Input
        type="search"
        placeholder="ابحث عن منتج، مادة، أو فئة…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 bg-transparent border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
      />
      <Button 
        type="submit"
        className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 font-black"
      >
        <Search className="ml-2 h-4 w-4" />
        بحث
      </Button>
    </form>
  );
};

export default SearchBar;