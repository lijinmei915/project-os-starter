import { useState } from "react";

export function useProviderSession({ fallbackModelCatalog, fallbackProvider }) {
  const [provider, setProvider] = useState(fallbackProvider);
  const [modelCatalog, setModelCatalog] = useState(fallbackModelCatalog);
  const [composerModels, setComposerModels] = useState([]);
  const [composerModelsKey, setComposerModelsKey] = useState("");
  const [composerModelsSource, setComposerModelsSource] = useState("");
  const [composerModelsLoading, setComposerModelsLoading] = useState(false);
  const [composerModelTests, setComposerModelTests] = useState({});
  const [composerModelTesting, setComposerModelTesting] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [providerReady, setProviderReady] = useState(false);
  return { composerModelTesting, composerModelTests, composerModels, composerModelsKey, composerModelsLoading, composerModelsSource, modelCatalog, provider, providerError, providerReady, setComposerModelTesting, setComposerModelTests, setComposerModels, setComposerModelsKey, setComposerModelsLoading, setComposerModelsSource, setModelCatalog, setProvider, setProviderError, setProviderReady };
}
