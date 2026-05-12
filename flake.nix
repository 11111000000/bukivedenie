{
  description = "bukivedenie development shell";

  outputs = { self }: let
    pkgs = import <nixpkgs> { };
    devScript = pkgs.writeShellScriptBin "bukivedenie-dev" ''
      exec ${pkgs.bashInteractive}/bin/bash ${builtins.toString ./scripts/dev_rollup.sh}
    '';
    backendScript = pkgs.writeShellScriptBin "bukivedenie-backend" ''
      exec ${pkgs.bashInteractive}/bin/bash ${builtins.toString ./scripts/backend.sh}
    '';
    smokeScript = pkgs.writeShellScriptBin "bukivedenie-smoke" ''
      exec ${pkgs.bashInteractive}/bin/bash ${builtins.toString ./scripts/ui_smoke.sh} "$@"
    '';
    shell = pkgs.mkShell {
      packages = with pkgs; [
        bashInteractive
        curl
        git
        gnumake
        chromium
        nodejs_22
        python3
        python3Packages.pytest
      ];

      shellHook = ''
        export CHROME_PATH=${pkgs.chromium}/bin/chromium
        export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
        echo "Entered bukivedenie dev shell. Use: make frontend-install, make dev, make ui-smoke, pytest"
      '';
    };
  in {
    devShells.${pkgs.stdenv.hostPlatform.system}.default = shell;

    apps.${pkgs.stdenv.hostPlatform.system} = {
      dev = {
        type = "app";
        program = "${devScript}/bin/bukivedenie-dev";
      };
      backend = {
        type = "app";
        program = "${backendScript}/bin/bukivedenie-backend";
      };
      smoke = {
        type = "app";
        program = "${smokeScript}/bin/bukivedenie-smoke";
      };
      default = {
        type = "app";
        program = "${devScript}/bin/bukivedenie-dev";
      };
    };
  };
}
