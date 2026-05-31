const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace reports tab logic
const reportsRegex = /{activeTab === 'reports' && \([\s\S]*?(?={activeTab === 'achievements' && \()/;
content = content.replace(reportsRegex, `
            {activeTab === 'names' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-bold text-white">Allowed Registration Names</h3>
                </div>
                <div className="space-y-4">
                  <p className="text-xs text-white/50">Add predefined names that users can select during registration. If this list is empty, users can type any name.</p>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      id="newAllowedName"
                      placeholder="Add a new name (e.g. Ayush)"
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-fc-neon-green/50 text-white"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const name = input.value.trim();
                          if (name) {
                            const newNames = [...(config.allowedNames || []), name];
                            await handleUpdateConfig({ ...config, allowedNames: newNames });
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button 
                      onClick={async () => {
                        const input = document.getElementById('newAllowedName');
                        const name = input.value.trim();
                        if (name) {
                          const newNames = [...(config.allowedNames || []), name];
                          await handleUpdateConfig({ ...config, allowedNames: newNames });
                          input.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-fc-neon-green text-black rounded-xl font-bold text-sm hover:bg-fc-purple-light transition-all cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                    {(config.allowedNames || []).map((name, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                        <span className="text-sm text-white font-bold">{name}</span>
                        <button 
                          onClick={async () => {
                            const newNames = (config.allowedNames || []).filter((_, i) => i !== idx);
                            await handleUpdateConfig({ ...config, allowedNames: newNames });
                          }}
                          className="p-1 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(!config.allowedNames || config.allowedNames.length === 0) && (
                      <div className="col-span-full p-4 border border-dashed border-white/20 rounded-xl text-center text-white/40 text-xs">
                        No allowed names set. Users can currently enter any full name.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            `);

const aiRegex = /{activeTab === 'ai' && \([\s\S]*?(?={activeTab === 'backup' && \()/;
content = content.replace(aiRegex, '');

const editsRegex = /{activeTab === 'edits' && \([\s\S]*?No edits found[\s\S]*?<\/div>[\s\S]*?}\)[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\)}\n/;
content = content.replace(editsRegex, '');

fs.writeFileSync('src/App.tsx', content);

console.log('Replacements completed.');
